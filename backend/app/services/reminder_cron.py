"""
Reminder cron worker — sends check-in and check-out notifications.

Runs every minute via APScheduler. Fires a notification when:
  - Check-in reminder: it is the configured checkin_reminder_time and
    the employee has NOT yet checked in today.
  - Check-out reminder: it is the configured checkout_reminder_time and
    the employee HAS checked in but NOT yet checked out.

Respects each user's `checkin_reminder_inapp` / `checkout_reminder_inapp`
notification preferences.
"""
from __future__ import annotations

import logging
from datetime import date, datetime

from sqlalchemy import select, and_, exists
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

log = logging.getLogger(__name__)


def _now_hhmm(tz_name: str) -> str:
    """Return current local time as 'HH:MM' for the given IANA timezone."""
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo  # type: ignore
    return datetime.now(ZoneInfo(tz_name)).strftime('%H:%M')


async def run_reminders() -> None:
  try:
    from app.models.attendance import Attendance
    from app.models.settings import AttendanceConfig, CompanySettings, NotificationPreference
    from app.models.notification import Notification, NotificationType
    from app.models.user import User

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # Load config
        config_res = await db.execute(select(AttendanceConfig).limit(1))
        config = config_res.scalar_one_or_none()
        if not config:
            return

        cs_res = await db.execute(select(CompanySettings).limit(1))
        cs = cs_res.scalar_one_or_none()
        tz = cs.timezone if cs else 'Asia/Kolkata'
        current_hhmm = _now_hhmm(tz)
        today = date.today()

        fire_checkin  = bool(config.checkin_reminder_time  and current_hhmm == config.checkin_reminder_time)
        fire_checkout = bool(config.checkout_reminder_time and current_hhmm == config.checkout_reminder_time)

        if not fire_checkin and not fire_checkout:
            return

        # Active employees
        users_res = await db.execute(
            select(User).where(User.is_active == True)
        )
        all_users: list[User] = users_res.scalars().all()
        if not all_users:
            return

        # Attendance records for today
        att_res = await db.execute(
            select(Attendance).where(Attendance.date == today)
        )
        today_att = {str(r.employee_id): r for r in att_res.scalars().all()}

        # Notification preferences
        user_ids_str = [str(u.id) for u in all_users]
        prefs_res = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id.in_(user_ids_str)
            )
        )
        prefs = {p.user_id: p for p in prefs_res.scalars().all()}

        notifications_to_create: list[Notification] = []

        for user in all_users:
            uid = str(user.id)
            pref = prefs.get(uid)
            att = today_att.get(uid)

            if fire_checkin:
                wants = pref.checkin_reminder_inapp if pref else True
                not_checked_in = att is None or att.check_in is None
                if wants and not_checked_in:
                    notifications_to_create.append(Notification(
                        user_id=user.id,
                        type=NotificationType.CHECKIN_REMINDER,
                        title='Check-in Reminder',
                        message=f"Don't forget to check in! Work starts at {config.checkin_reminder_time}.",
                        link='/attendance',
                    ))

            if fire_checkout:
                wants = pref.checkout_reminder_inapp if pref else True
                needs_checkout = att is not None and att.check_in is not None and att.check_out is None
                if wants and needs_checkout:
                    notifications_to_create.append(Notification(
                        user_id=user.id,
                        type=NotificationType.CHECKOUT_REMINDER,
                        title='Check-out Reminder',
                        message="Don't forget to check out before leaving!",
                        link='/attendance',
                    ))

        if notifications_to_create:
            db.add_all(notifications_to_create)
            await db.commit()
            log.info(
                "Reminder cron: sent %d check-in + checkout notifications at %s",
                len(notifications_to_create), current_hhmm,
            )

    await engine.dispose()
  except Exception as e:
    log.error(f"Reminder cron failed: {e}", exc_info=True)
