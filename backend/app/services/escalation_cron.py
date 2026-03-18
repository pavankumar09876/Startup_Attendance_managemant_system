"""
Escalation cron — sends reminders for overdue pending approvals.

Runs daily via APScheduler. Fires a notification when:
  - Leave request pending > 2 days → remind approver
  - Expense pending > 3 days → remind approver
  - Leave/Expense pending > 5 days → escalate to HR/Admin
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

log = logging.getLogger(__name__)

# Thresholds (in days)
LEAVE_REMINDER_DAYS = 2
EXPENSE_REMINDER_DAYS = 3
ESCALATION_DAYS = 5


async def run_escalation() -> None:
    try:
        from app.models.leave import Leave, LeaveStatus
        from app.models.payroll import Expense, ExpenseStatus
        from app.models.user import User, Role
        from app.models.notification import Notification, NotificationType

        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        now = datetime.now(timezone.utc)
        notifications: list[Notification] = []

        async with Session() as db:
            # ── Pending leaves ────────────────────────────────────────────────
            leave_reminder_cutoff = now - timedelta(days=LEAVE_REMINDER_DAYS)
            escalation_cutoff = now - timedelta(days=ESCALATION_DAYS)

            pending_leaves = (await db.execute(
                select(Leave).where(
                    Leave.status == LeaveStatus.PENDING,
                    Leave.created_at <= leave_reminder_cutoff,
                )
            )).scalars().all()

            for leave in pending_leaves:
                # Find the employee to get their manager
                emp = (await db.execute(
                    select(User).where(User.id == leave.employee_id)
                )).scalar_one_or_none()
                if not emp:
                    continue

                is_escalation = leave.created_at <= escalation_cutoff

                if is_escalation:
                    # Escalate to HR/Admin
                    hr_admins = (await db.execute(
                        select(User).where(
                            User.is_active == True,
                            User.role.in_([Role.HR, Role.ADMIN]),
                        )
                    )).scalars().all()
                    for admin in hr_admins:
                        notifications.append(Notification(
                            user_id=admin.id,
                            type=NotificationType.GENERAL,
                            title="Escalation: Overdue Leave Approval",
                            message=f"Leave request from {emp.first_name} {emp.last_name} has been pending for {(now - leave.created_at).days} days.",
                            link="/leave",
                            priority="high",
                            category="leave",
                            action_type="approve_reject",
                            action_entity_type="leave",
                            action_entity_id=leave.id,
                        ))
                elif emp.manager_id:
                    # Remind the manager
                    notifications.append(Notification(
                        user_id=emp.manager_id,
                        type=NotificationType.GENERAL,
                        title="Reminder: Pending Leave Approval",
                        message=f"Leave request from {emp.first_name} {emp.last_name} is awaiting your approval ({(now - leave.created_at).days} days).",
                        link="/leave",
                        priority="normal",
                        category="leave",
                        action_type="approve_reject",
                        action_entity_type="leave",
                        action_entity_id=leave.id,
                    ))

            # ── Pending expenses ──────────────────────────────────────────────
            expense_reminder_cutoff = now - timedelta(days=EXPENSE_REMINDER_DAYS)

            pending_expenses = (await db.execute(
                select(Expense).where(
                    Expense.status == ExpenseStatus.PENDING,
                    Expense.created_at <= expense_reminder_cutoff,
                )
            )).scalars().all()

            for expense in pending_expenses:
                emp = (await db.execute(
                    select(User).where(User.id == expense.employee_id)
                )).scalar_one_or_none()
                if not emp:
                    continue

                is_escalation = expense.created_at <= escalation_cutoff

                if is_escalation:
                    hr_admins = (await db.execute(
                        select(User).where(
                            User.is_active == True,
                            User.role.in_([Role.HR, Role.ADMIN]),
                        )
                    )).scalars().all()
                    for admin in hr_admins:
                        notifications.append(Notification(
                            user_id=admin.id,
                            type=NotificationType.GENERAL,
                            title="Escalation: Overdue Expense Approval",
                            message=f"Expense claim ₹{expense.amount} from {emp.first_name} {emp.last_name} has been pending for {(now - expense.created_at).days} days.",
                            link="/payroll/expenses",
                            priority="high",
                            category="expense",
                            action_type="approve_reject",
                            action_entity_type="expense",
                            action_entity_id=expense.id,
                        ))
                elif emp.manager_id:
                    notifications.append(Notification(
                        user_id=emp.manager_id,
                        type=NotificationType.GENERAL,
                        title="Reminder: Pending Expense Approval",
                        message=f"Expense claim ₹{expense.amount} from {emp.first_name} {emp.last_name} is awaiting approval ({(now - expense.created_at).days} days).",
                        link="/payroll/expenses",
                        priority="normal",
                        category="expense",
                        action_type="approve_reject",
                        action_entity_type="expense",
                        action_entity_id=expense.id,
                    ))

            if notifications:
                db.add_all(notifications)
                await db.commit()
                log.info("Escalation cron: sent %d reminders/escalations", len(notifications))

        await engine.dispose()
    except Exception as e:
        log.error(f"Escalation cron failed: {e}", exc_info=True)
