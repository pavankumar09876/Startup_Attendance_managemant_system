"""Onboarding cron: clean expired invites, remind about stale onboarding."""

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_
from app.database import AsyncSessionLocal
from app.models.user import User, EmployeeStatus, Role
from app.models.settings import CompanySettings
from app.models.notification import NotificationType
from app.routers.notifications_router import push_notification

logger = logging.getLogger("workforce.onboarding_cron")

# Statuses considered "in onboarding" — stale if stuck too long
ONBOARDING_STATUSES = [
    EmployeeStatus.OFFER_SENT,
    EmployeeStatus.OFFER_ACCEPTED,
    EmployeeStatus.PRE_ONBOARDING,
    EmployeeStatus.JOINED,
]


async def run_onboarding_cron():
    """Runs daily — expires invite tokens and notifies HR about stale onboarding."""
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.now(timezone.utc)

            # 1. Expire invite tokens past their deadline
            result = await db.execute(
                select(User).where(
                    and_(
                        User.invite_token != None,
                        User.invite_token_expires_at != None,
                        User.invite_token_expires_at < now,
                    )
                )
            )
            expired_users = result.scalars().all()
            for user in expired_users:
                user.invite_token = None
                user.invite_token_expires_at = None
                logger.info(
                    "Expired invite token for %s %s (%s)",
                    user.first_name, user.last_name, user.email,
                )

            if expired_users:
                await db.commit()
                logger.info("Expired %d invite token(s)", len(expired_users))

            # 2. Stale onboarding reminders — notify HR users
            settings_result = await db.execute(select(CompanySettings).limit(1))
            company = settings_result.scalars().first()
            stale_days = company.onboarding_stale_days if company else 7

            cutoff = now - timedelta(days=stale_days)
            stale_result = await db.execute(
                select(User).where(
                    and_(
                        User.status.in_(ONBOARDING_STATUSES),
                        User.created_at < cutoff,
                        User.is_active == True,
                    )
                )
            )
            stale_employees = stale_result.scalars().all()

            if stale_employees:
                # Get all HR and Admin users to notify
                hr_result = await db.execute(
                    select(User).where(
                        and_(
                            User.role.in_([Role.HR, Role.ADMIN, Role.SUPER_ADMIN]),
                            User.is_active == True,
                        )
                    )
                )
                hr_users = hr_result.scalars().all()

                for stale_emp in stale_employees:
                    days_stuck = (now - stale_emp.created_at.replace(tzinfo=timezone.utc)).days
                    status_label = stale_emp.status.value.replace("_", " ").title()

                    for hr_user in hr_users:
                        await push_notification(
                            db=db,
                            user_id=hr_user.id,
                            type_=NotificationType.GENERAL,
                            title="Stale Onboarding",
                            message=(
                                f"{stale_emp.first_name} {stale_emp.last_name} has been in "
                                f"'{status_label}' for {days_stuck} days"
                            ),
                            link="/onboarding",
                            category="onboarding",
                            action_type="view",
                            action_entity_type="employee",
                            action_entity_id=stale_emp.id,
                            priority="high",
                        )

                    logger.info(
                        "Stale onboarding: %s %s — %s for %d days",
                        stale_emp.first_name, stale_emp.last_name,
                        status_label, days_stuck,
                    )

                await db.commit()
                logger.info(
                    "Sent stale onboarding reminders for %d employee(s) to %d HR user(s)",
                    len(stale_employees), len(hr_users),
                )

            # 3. SLA breach detection — check configured stage deadlines
            from app.services.onboarding_service import check_sla_breaches
            new_breaches = await check_sla_breaches(db)

            if new_breaches:
                # Notify escalation targets about new SLA breaches
                from app.models.onboarding import SLABreach, OnboardingSLAConfig
                from app.models.user import Role as _Role

                unresolved = (await db.execute(
                    select(SLABreach).where(
                        and_(
                            SLABreach.resolved_at == None,
                            SLABreach.escalated_to == None,
                        )
                    )
                )).scalars().all()

                sla_configs = (await db.execute(
                    select(OnboardingSLAConfig).where(OnboardingSLAConfig.is_active == True)
                )).scalars().all()
                config_map = {c.stage: c for c in sla_configs}

                for breach in unresolved:
                    sla_cfg = config_map.get(breach.stage)
                    if not sla_cfg or not sla_cfg.auto_notify:
                        continue

                    escalation_role = sla_cfg.escalation_role or "admin"
                    role_enum_map = {
                        "admin": _Role.ADMIN, "super_admin": _Role.SUPER_ADMIN,
                        "hr": _Role.HR, "manager": _Role.MANAGER,
                    }
                    target_role = role_enum_map.get(escalation_role, _Role.ADMIN)

                    targets = (await db.execute(
                        select(User).where(
                            and_(User.role == target_role, User.is_active == True)
                        )
                    )).scalars().all()

                    emp = await db.get(User, breach.employee_id)
                    emp_name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"

                    for target in targets:
                        await push_notification(
                            db=db, user_id=target.id,
                            type_=NotificationType.GENERAL,
                            title="SLA Breach",
                            message=(
                                f"{emp_name} has exceeded the SLA for "
                                f"'{breach.stage.replace('_', ' ').title()}' "
                                f"({breach.actual_days}d vs {breach.sla_days}d limit)"
                            ),
                            link="/onboarding",
                            category="onboarding",
                            action_type="escalation",
                            action_entity_type="employee",
                            action_entity_id=breach.employee_id,
                            priority="high",
                        )
                        breach.escalated_to = target.id  # Mark first target

                    logger.info(
                        "SLA breach: %s in '%s' for %dd (limit %dd)",
                        emp_name, breach.stage, breach.actual_days, breach.sla_days,
                    )

                await db.commit()
                logger.info("Detected %d new SLA breach(es)", new_breaches)

        except Exception:
            logger.exception("Onboarding cron failed")
            await db.rollback()
