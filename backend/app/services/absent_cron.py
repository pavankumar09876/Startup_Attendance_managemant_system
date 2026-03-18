"""
Auto-absent cron worker — marks employees as ABSENT at the configured time.

Runs every minute via APScheduler. When the current local time matches
`AttendanceConfig.auto_absent_after_time` and `auto_mark_absent` is True,
creates ABSENT records for all active employees who haven't checked in today.
"""
from __future__ import annotations

import logging
from datetime import date, datetime

from sqlalchemy import select

log = logging.getLogger(__name__)


def _now_hhmm(tz_name: str) -> str:
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo  # type: ignore
    return datetime.now(ZoneInfo(tz_name)).strftime('%H:%M')


async def run_auto_absent() -> None:
  try:
    from app.models.attendance import Attendance, AttendanceStatus
    from app.models.settings import AttendanceConfig, CompanySettings
    from app.models.user import User
    from app.database import AsyncSessionLocal  # reuse shared session factory

    async with AsyncSessionLocal() as db:
        config_res = await db.execute(select(AttendanceConfig).limit(1))
        config = config_res.scalar_one_or_none()
        if not config or not config.auto_mark_absent or not config.auto_absent_after_time:
            return

        cs_res = await db.execute(select(CompanySettings).limit(1))
        cs = cs_res.scalar_one_or_none()
        tz = cs.timezone if cs else 'Asia/Kolkata'

        current_hhmm = _now_hhmm(tz)
        if current_hhmm != config.auto_absent_after_time:
            return

        today = date.today()

        # All active employees
        users_res = await db.execute(select(User).where(User.is_active == True))
        all_users = users_res.scalars().all()
        if not all_users:
            return

        # Today's attendance records (any status — checked-in, on_leave, holiday, etc.)
        att_res = await db.execute(select(Attendance).where(Attendance.date == today))
        existing_ids = {str(r.employee_id) for r in att_res.scalars().all()}

        records = [
            Attendance(
                employee_id=user.id,
                date=today,
                status=AttendanceStatus.ABSENT,
            )
            for user in all_users
            if str(user.id) not in existing_ids
        ]

        if records:
            db.add_all(records)
            await db.commit()
            log.info(
                "Auto-absent cron: marked %d employees as ABSENT on %s",
                len(records), today,
            )
  except Exception as e:
    log.error(f"Auto-absent cron failed: {e}", exc_info=True)
