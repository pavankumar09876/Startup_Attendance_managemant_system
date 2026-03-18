"""
Centralized notification creation with category and action metadata.
"""

import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.routers.notifications_router import push_notification
from app.models.notification import NotificationType


async def notify_leave_request(db: AsyncSession, manager_id: uuid.UUID, leave):
    """Notify manager of a new leave request (actionable: approve/reject)."""
    await push_notification(
        db=db,
        user_id=manager_id,
        type_=NotificationType.LEAVE_REQUESTED,
        title="Leave Request",
        message=f"New {leave.leave_type.value} leave request ({leave.start_date} – {leave.end_date})",
        link="/leave",
        category="leave",
        action_type="approve_reject",
        action_entity_type="leave",
        action_entity_id=leave.id,
        priority="high",
    )


async def notify_expense_submitted(db: AsyncSession, reviewer_id: uuid.UUID, expense):
    """Notify reviewer of a new expense submission (actionable: approve/reject)."""
    await push_notification(
        db=db,
        user_id=reviewer_id,
        type_=NotificationType.EXPENSE_SUBMITTED,
        title="Expense Submitted",
        message=f"New expense: {expense.title} — ₹{expense.amount}",
        link="/expenses",
        category="expense",
        action_type="approve_reject",
        action_entity_type="expense",
        action_entity_id=expense.id,
        priority="normal",
    )


async def notify_task_assigned(db: AsyncSession, assignee_id: uuid.UUID, task):
    """Notify assignee of a new task assignment."""
    await push_notification(
        db=db,
        user_id=assignee_id,
        type_=NotificationType.TASK_ASSIGNED,
        title="Task Assigned",
        message=f"You've been assigned: {task.title}",
        link=f"/tasks",
        category="task",
        action_type="view",
        action_entity_type="task",
        action_entity_id=task.id,
        priority="normal",
    )
