"""
Digest cron — sends daily summary email to managers/admins with pending approvals.

Runs daily at 8:00 AM via APScheduler.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from collections import defaultdict

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

log = logging.getLogger(__name__)


async def run_digest() -> None:
    try:
        from app.models.leave import Leave, LeaveStatus
        from app.models.payroll import Expense, ExpenseStatus
        from app.models.user import User, Role
        from app.models.notification import Notification, NotificationType

        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with Session() as db:
            # ── Count pending items per manager ──────────────────────────────
            # Pending leaves grouped by employee's manager
            pending_leaves = (await db.execute(
                select(User.manager_id, func.count(Leave.id))
                .join(User, Leave.employee_id == User.id)
                .where(Leave.status == LeaveStatus.PENDING, User.manager_id.isnot(None))
                .group_by(User.manager_id)
            )).all()
            leave_counts = {row[0]: row[1] for row in pending_leaves}

            # Pending expenses grouped by employee's manager
            pending_expenses = (await db.execute(
                select(User.manager_id, func.count(Expense.id))
                .join(User, Expense.employee_id == User.id)
                .where(Expense.status == ExpenseStatus.PENDING, User.manager_id.isnot(None))
                .group_by(User.manager_id)
            )).all()
            expense_counts = {row[0]: row[1] for row in pending_expenses}

            # All managers who have pending items
            manager_ids = set(leave_counts.keys()) | set(expense_counts.keys())
            if not manager_ids:
                return

            # Also send digest to HR/Admin for all pending items
            total_pending_leaves = sum(leave_counts.values())
            total_pending_expenses = sum(expense_counts.values())

            hr_admins = (await db.execute(
                select(User).where(
                    User.is_active == True,
                    User.role.in_([Role.HR, Role.ADMIN]),
                )
            )).scalars().all()

            notifications: list[Notification] = []

            # Manager digests
            for mgr_id in manager_ids:
                leaves = leave_counts.get(mgr_id, 0)
                expenses = expense_counts.get(mgr_id, 0)
                parts = []
                if leaves:
                    parts.append(f"{leaves} leave request{'s' if leaves > 1 else ''}")
                if expenses:
                    parts.append(f"{expenses} expense claim{'s' if expenses > 1 else ''}")
                if parts:
                    notifications.append(Notification(
                        user_id=mgr_id,
                        type=NotificationType.GENERAL,
                        title="Daily Digest: Pending Approvals",
                        message=f"You have {' and '.join(parts)} awaiting your approval.",
                        link="/dashboard",
                        priority="normal",
                        category="system",
                    ))

            # HR/Admin digest (total across org)
            if total_pending_leaves or total_pending_expenses:
                parts = []
                if total_pending_leaves:
                    parts.append(f"{total_pending_leaves} leave request{'s' if total_pending_leaves > 1 else ''}")
                if total_pending_expenses:
                    parts.append(f"{total_pending_expenses} expense claim{'s' if total_pending_expenses > 1 else ''}")
                for admin in hr_admins:
                    notifications.append(Notification(
                        user_id=admin.id,
                        type=NotificationType.GENERAL,
                        title="Daily Digest: Organization Approvals",
                        message=f"Organization-wide: {' and '.join(parts)} pending across all teams.",
                        link="/dashboard",
                        priority="normal",
                        category="system",
                    ))

            if notifications:
                db.add_all(notifications)
                await db.commit()
                log.info("Digest cron: sent %d digest notifications", len(notifications))

        await engine.dispose()
    except Exception as e:
        log.error(f"Digest cron failed: {e}", exc_info=True)
