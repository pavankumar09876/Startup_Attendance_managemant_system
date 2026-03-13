"""Global tasks router — /api/tasks  (cross-project)"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import Optional

from app.database import get_db
from app.models.project import Task, TaskStatus, TaskPriority
from app.models.user import User, Role
from app.schemas.project import TaskOut
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/my", response_model=list[TaskOut])
async def my_tasks(
    status:   Optional[TaskStatus]   = None,
    priority: Optional[TaskPriority] = None,
    due:      Optional[str]          = Query(None, description="today|week|overdue"),
    db:       AsyncSession           = Depends(get_db),
    current:  User                   = Depends(get_current_user),
):
    today = date.today()
    q = select(Task).where(Task.assignee_id == current.id)

    if status:
        q = q.where(Task.status == status)
    if priority:
        q = q.where(Task.priority == priority)
    if due == "today":
        q = q.where(Task.due_date == today)
    elif due == "week":
        from datetime import timedelta
        q = q.where(Task.due_date >= today, Task.due_date <= today + timedelta(days=7))
    elif due == "overdue":
        q = q.where(Task.due_date < today, Task.status != TaskStatus.DONE)
    elif due == "completed":
        q = q.where(Task.status == TaskStatus.DONE)

    q = q.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()
