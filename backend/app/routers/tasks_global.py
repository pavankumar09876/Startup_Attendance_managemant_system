"""Global tasks router — /api/tasks  (cross-project)"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import Optional
import uuid as uuid_mod

from app.database import get_db
from app.models.project import Task, TaskActivity, TaskStatus, TaskPriority, TaskComment, TaskDependency, RecurringTask, TimeLog, SavedTaskView
from app.models.user import User, Role
from app.schemas.project import (
    TaskOut, TaskUpdate, TaskCommentCreate, TaskCommentOut,
    TaskDependencyCreate, TaskDependencyOut,
    RecurringTaskCreate, RecurringTaskOut,
    TaskActivityOut,
    TimeLogCreate, TimeLogOut,
    SavedTaskViewCreate, SavedTaskViewUpdate, SavedTaskViewOut,
)
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# Fields worth tracking in activity log
TRACKED_FIELDS = {"status", "priority", "assignee_id", "title", "description", "due_date", "sprint_id", "story_points", "issue_type", "epic_id"}

# Human-friendly field labels for the activity log
FIELD_LABELS = {
    "status": "status", "priority": "priority", "assignee_id": "assignee",
    "title": "title", "description": "description", "due_date": "due date",
    "sprint_id": "sprint", "story_points": "story points", "issue_type": "issue type",
    "epic_id": "epic",
}


# Statuses that require all blocking dependencies to be done first
_FORWARD_STATUSES = {TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE}


async def check_dependencies_met(
    db: AsyncSession, task_id: uuid_mod.UUID, new_status: TaskStatus,
) -> None:
    """Raise 400 if task has incomplete blocking dependencies and is moving forward."""
    if new_status not in _FORWARD_STATUSES:
        return  # Moving to todo/blocked is always allowed

    # Get all blocking task IDs
    deps = await db.execute(
        select(TaskDependency.blocking_task_id)
        .where(TaskDependency.task_id == task_id)
    )
    blocking_ids = [row[0] for row in deps.all()]
    if not blocking_ids:
        return

    # Find blockers that aren't done yet
    incomplete = (await db.execute(
        select(Task.title)
        .where(Task.id.in_(blocking_ids), Task.status != TaskStatus.DONE)
    )).all()

    if incomplete:
        names = ", ".join(f'"{row.title}"' for row in incomplete[:3])
        suffix = f" and {len(incomplete) - 3} more" if len(incomplete) > 3 else ""
        raise HTTPException(
            status_code=400,
            detail=f"Blocked by incomplete dependencies: {names}{suffix}. Resolve them first.",
        )


async def _log_task_activity(
    db: AsyncSession, task_id: uuid_mod.UUID, actor: User,
    action: str, field: Optional[str] = None,
    old_value: Optional[str] = None, new_value: Optional[str] = None,
) -> None:
    db.add(TaskActivity(
        task_id=task_id,
        actor_id=actor.id,
        actor_name=f"{actor.first_name} {actor.last_name}",
        action=action,
        field=field,
        old_value=old_value,
        new_value=new_value,
    ))


async def _validate_epic_assignment(
    db: AsyncSession, task_id: uuid_mod.UUID, epic_id: uuid_mod.UUID,
) -> None:
    """Validate that epic_id points to a real epic and prevent circular references."""
    from app.models.project import IssueType

    if epic_id == task_id:
        raise HTTPException(400, "A task cannot be its own epic")

    epic = (await db.execute(select(Task).where(Task.id == epic_id))).scalar_one_or_none()
    if not epic:
        raise HTTPException(404, "Epic not found")
    if epic.issue_type != IssueType.EPIC:
        raise HTTPException(400, "Target task is not an epic")

    # Prevent assigning an epic to another epic
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if task and task.issue_type == IssueType.EPIC:
        raise HTTPException(400, "Epics cannot be nested under other epics")


@router.get("/my", response_model=list[TaskOut])
async def my_tasks(
    status:      Optional[TaskStatus]   = None,
    priority:    Optional[TaskPriority] = None,
    due:         Optional[str]          = Query(None, description="today|week|overdue|completed"),
    label:       Optional[str]          = Query(None, description="Filter by label"),
    assignee_id: Optional[uuid_mod.UUID] = None,
    sprint_id:   Optional[uuid_mod.UUID] = None,
    project_id:  Optional[uuid_mod.UUID] = None,
    issue_type:  Optional[str]          = None,
    search:      Optional[str]          = None,
    due_from:    Optional[date]         = Query(None, description="Due date >= (YYYY-MM-DD)"),
    due_to:      Optional[date]         = Query(None, description="Due date <= (YYYY-MM-DD)"),
    skip:        int                    = Query(0, ge=0),
    limit:       int                    = Query(100, ge=1, le=500),
    db:          AsyncSession           = Depends(get_db),
    current:     User                   = Depends(get_current_user),
):
    from datetime import timedelta
    today = date.today()

    # Base: only my tasks (unless assignee_id explicitly overrides for managers)
    q = select(Task)
    if assignee_id:
        q = q.where(Task.assignee_id == assignee_id)
    else:
        q = q.where(Task.assignee_id == current.id)

    if project_id:
        q = q.where(Task.project_id == project_id)
    if status:
        q = q.where(Task.status == status)
    if priority:
        q = q.where(Task.priority == priority)
    if label:
        q = q.where(Task.labels.any(label))
    if sprint_id:
        q = q.where(Task.sprint_id == sprint_id)
    if issue_type:
        from app.models.project import IssueType
        q = q.where(Task.issue_type == IssueType(issue_type))
    if search:
        q = q.where(Task.title.ilike(f"%{search}%"))

    # Date range filters (explicit due_from/due_to take priority over preset)
    if due_from or due_to:
        if due_from:
            q = q.where(Task.due_date >= due_from)
        if due_to:
            q = q.where(Task.due_date <= due_to)
    elif due == "today":
        q = q.where(Task.due_date == today)
    elif due == "week":
        q = q.where(Task.due_date >= today, Task.due_date <= today + timedelta(days=7))
    elif due == "overdue":
        q = q.where(Task.due_date < today, Task.status != TaskStatus.DONE)
    elif due == "completed":
        q = q.where(Task.status == TaskStatus.DONE)

    q = q.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
    result = await db.execute(q.offset(skip).limit(limit))
    return result.scalars().all()


# ── Single task GET + PATCH ──────────────────────────────────────────────────

@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid_mod.UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    changes = payload.model_dump(exclude_none=True)

    # Enforce dependencies before allowing status progression
    if "status" in changes:
        await check_dependencies_met(db, task_id, TaskStatus(changes["status"]))

    # Validate epic_id assignment
    if "epic_id" in changes:
        await _validate_epic_assignment(db, task_id, changes["epic_id"])

    for field, new_value in changes.items():
        old_value = getattr(task, field, None)
        # Convert enums to string for comparison
        old_str = old_value.value if hasattr(old_value, 'value') else str(old_value) if old_value is not None else None
        new_str = new_value.value if hasattr(new_value, 'value') else str(new_value) if new_value is not None else None

        if old_str != new_str and field in TRACKED_FIELDS:
            await _log_task_activity(
                db, task_id, current, action="updated",
                field=FIELD_LABELS.get(field, field),
                old_value=old_str, new_value=new_str,
            )
        setattr(task, field, new_value)

    await db.commit()
    await db.refresh(task)
    return task


# ── Activity log ─────────────────────────────────────────────────────────────

@router.get("/{task_id}/activity", response_model=list[TaskActivityOut])
async def list_task_activity(
    task_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskActivity)
        .where(TaskActivity.task_id == task_id)
        .order_by(TaskActivity.created_at.desc())
    )
    return result.scalars().all()


# ── Subtasks ─────────────────────────────────────────────────────────────────
@router.get("/{task_id}/subtasks", response_model=list[TaskOut])
async def list_subtasks(
    task_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).where(Task.parent_id == task_id).order_by(Task.created_at)
    )
    return result.scalars().all()


# ── Epics ────────────────────────────────────────────────────────────────────

@router.get("/{epic_id}/children", response_model=list[TaskOut])
async def list_epic_children(
    epic_id: uuid_mod.UUID,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """List all tasks/stories/bugs linked to this epic."""
    from app.models.project import IssueType
    epic = (await db.execute(select(Task).where(Task.id == epic_id))).scalar_one_or_none()
    if not epic:
        raise HTTPException(404, "Epic not found")
    if epic.issue_type != IssueType.EPIC:
        raise HTTPException(400, "Task is not an epic")

    q = select(Task).where(Task.epic_id == epic_id)
    if status:
        q = q.where(Task.status == TaskStatus(status))
    if priority:
        q = q.where(Task.priority == TaskPriority(priority))
    q = q.order_by(Task.priority.desc(), Task.created_at)

    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{epic_id}/progress")
async def epic_progress(
    epic_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Get epic progress summary: total, done, in-progress, status breakdown."""
    from app.models.project import IssueType
    from sqlalchemy import func as sa_func

    epic = (await db.execute(select(Task).where(Task.id == epic_id))).scalar_one_or_none()
    if not epic:
        raise HTTPException(404, "Epic not found")
    if epic.issue_type != IssueType.EPIC:
        raise HTTPException(400, "Task is not an epic")

    children = (await db.execute(
        select(Task.status, sa_func.count(Task.id))
        .where(Task.epic_id == epic_id)
        .group_by(Task.status)
    )).all()

    status_counts = {row[0].value: row[1] for row in children}
    total = sum(status_counts.values())
    done = status_counts.get("done", 0)

    # Story points summary
    sp_result = (await db.execute(
        select(
            sa_func.coalesce(sa_func.sum(Task.story_points), 0),
            sa_func.coalesce(
                sa_func.sum(Task.story_points).filter(Task.status == TaskStatus.DONE), 0
            ),
        )
        .where(Task.epic_id == epic_id)
    )).one()

    return {
        "total_children": total,
        "done": done,
        "progress_pct": round((done / total) * 100) if total > 0 else 0,
        "status_breakdown": status_counts,
        "total_story_points": int(sp_result[0]),
        "completed_story_points": int(sp_result[1]),
    }


# ── Comments ─────────────────────────────────────────────────────────────────
@router.get("/{task_id}/comments", response_model=list[TaskCommentOut])
async def list_comments(
    task_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at)
    )
    return result.scalars().all()


@router.post("/{task_id}/comments", response_model=TaskCommentOut, status_code=201)
async def add_comment(
    task_id: uuid_mod.UUID,
    payload: TaskCommentCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Verify task exists
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    comment = TaskComment(task_id=task_id, user_id=current.id, content=payload.content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.delete("/{task_id}/comments/{comment_id}")
async def delete_comment(
    task_id: uuid_mod.UUID,
    comment_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    comment = (await db.execute(
        select(TaskComment).where(TaskComment.id == comment_id, TaskComment.task_id == task_id)
    )).scalar_one_or_none()
    if not comment:
        raise HTTPException(404, "Comment not found")
    if comment.user_id != current.id and current.role not in (Role.SUPER_ADMIN, Role.ADMIN):
        raise HTTPException(403, "Forbidden")
    await db.delete(comment)
    await db.commit()
    return {"message": "Comment deleted"}


# ── Dependencies ─────────────────────────────────────────────────────────────
@router.get("/{task_id}/dependencies", response_model=list[TaskDependencyOut])
async def list_dependencies(
    task_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id == task_id)
    )
    return result.scalars().all()


@router.post("/{task_id}/dependencies", response_model=TaskDependencyOut, status_code=201)
async def add_dependency(
    task_id: uuid_mod.UUID,
    payload: TaskDependencyCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Prevent self-dependency
    if task_id == payload.blocking_task_id:
        raise HTTPException(400, "Task cannot depend on itself")
    # Check both tasks exist
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    blocker = (await db.execute(select(Task).where(Task.id == payload.blocking_task_id))).scalar_one_or_none()
    if not task or not blocker:
        raise HTTPException(404, "Task not found")
    # Check for duplicate
    existing = (await db.execute(
        select(TaskDependency).where(
            TaskDependency.task_id == task_id,
            TaskDependency.blocking_task_id == payload.blocking_task_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Dependency already exists")

    dep = TaskDependency(task_id=task_id, blocking_task_id=payload.blocking_task_id)
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
    return dep


@router.delete("/{task_id}/dependencies/{dep_id}")
async def remove_dependency(
    task_id: uuid_mod.UUID,
    dep_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    dep = (await db.execute(
        select(TaskDependency).where(TaskDependency.id == dep_id, TaskDependency.task_id == task_id)
    )).scalar_one_or_none()
    if not dep:
        raise HTTPException(404, "Dependency not found")
    await db.delete(dep)
    await db.commit()
    return {"message": "Dependency removed"}


# ── Time Logs ────────────────────────────────────────────────────────────────

@router.get("/{task_id}/timelogs", response_model=list[TimeLogOut])
async def list_time_logs(
    task_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    from sqlalchemy.orm import joinedload
    result = await db.execute(
        select(TimeLog)
        .options(joinedload(TimeLog.user))
        .where(TimeLog.task_id == task_id)
        .order_by(TimeLog.date.desc(), TimeLog.created_at.desc())
    )
    logs = result.scalars().unique().all()

    # Attach user_name for the response
    out = []
    for log in logs:
        data = TimeLogOut.model_validate(log)
        data.user_name = f"{log.user.first_name} {log.user.last_name}" if log.user else "Unknown"
        out.append(data)
    return out


@router.post("/{task_id}/timelogs", response_model=TimeLogOut, status_code=201)
async def log_time(
    task_id: uuid_mod.UUID,
    payload: TimeLogCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    if payload.hours <= 0:
        raise HTTPException(400, "Hours must be greater than 0")
    if payload.hours > 24:
        raise HTTPException(400, "Cannot log more than 24 hours in a single entry")

    log = TimeLog(
        task_id=task_id,
        user_id=current.id,
        hours=payload.hours,
        description=payload.description,
        date=payload.date,
    )
    db.add(log)

    # Log activity
    await _log_task_activity(
        db, task_id, current, action="logged_time",
        field="time", new_value=f"{payload.hours}h on {payload.date}",
    )

    await db.commit()
    await db.refresh(log)

    out = TimeLogOut.model_validate(log)
    out.user_name = f"{current.first_name} {current.last_name}"
    return out


@router.delete("/{task_id}/timelogs/{log_id}")
async def delete_time_log(
    task_id: uuid_mod.UUID,
    log_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    log = (await db.execute(
        select(TimeLog).where(TimeLog.id == log_id, TimeLog.task_id == task_id)
    )).scalar_one_or_none()
    if not log:
        raise HTTPException(404, "Time log not found")
    # Only the author or admins can delete
    if log.user_id != current.id and current.role not in (Role.SUPER_ADMIN, Role.ADMIN):
        raise HTTPException(403, "Forbidden")
    await db.delete(log)
    await db.commit()
    return {"message": "Time log deleted"}


# ── Recurring Tasks ──────────────────────────────────────────────────────────
@router.get("/recurring", response_model=list[RecurringTaskOut])
async def list_recurring(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    result = await db.execute(
        select(RecurringTask).where(RecurringTask.is_active == True)
    )
    return result.scalars().all()


@router.post("/recurring", response_model=RecurringTaskOut, status_code=201)
async def create_recurring(
    payload: RecurringTaskCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    if payload.recurrence_rule not in ("daily", "weekly", "biweekly", "monthly"):
        raise HTTPException(400, "Invalid recurrence rule")
    rec = RecurringTask(**payload.model_dump())
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


@router.delete("/recurring/{rec_id}")
async def deactivate_recurring(
    rec_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    rec = (await db.execute(select(RecurringTask).where(RecurringTask.id == rec_id))).scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "Recurring task not found")
    rec.is_active = False
    await db.commit()
    return {"message": "Recurring task deactivated"}


# ── Saved Task Views ────────────────────────────────────────────────────────

@router.get("/views/saved", response_model=list[SavedTaskViewOut])
async def list_saved_views(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedTaskView)
        .where(SavedTaskView.user_id == current.id)
        .order_by(SavedTaskView.position, SavedTaskView.created_at)
    )
    return result.scalars().all()


@router.post("/views/saved", response_model=SavedTaskViewOut, status_code=201)
async def create_saved_view(
    payload: SavedTaskViewCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Cap at 20 saved views per user
    count = (await db.execute(
        select(SavedTaskView.id).where(SavedTaskView.user_id == current.id)
    )).all()
    if len(count) >= 20:
        raise HTTPException(400, "Maximum 20 saved views allowed")

    # If marking as default, clear previous default
    if payload.is_default:
        existing = (await db.execute(
            select(SavedTaskView)
            .where(SavedTaskView.user_id == current.id, SavedTaskView.is_default == True)
        )).scalars().all()
        for v in existing:
            v.is_default = False

    view = SavedTaskView(
        user_id=current.id,
        name=payload.name,
        filters=payload.filters,
        is_default=payload.is_default,
        position=len(count),
    )
    db.add(view)
    await db.commit()
    await db.refresh(view)
    return view


@router.patch("/views/saved/{view_id}", response_model=SavedTaskViewOut)
async def update_saved_view(
    view_id: uuid_mod.UUID,
    payload: SavedTaskViewUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    view = (await db.execute(
        select(SavedTaskView).where(SavedTaskView.id == view_id, SavedTaskView.user_id == current.id)
    )).scalar_one_or_none()
    if not view:
        raise HTTPException(404, "Saved view not found")

    changes = payload.model_dump(exclude_none=True)

    # If marking as default, clear previous default
    if changes.get("is_default"):
        existing = (await db.execute(
            select(SavedTaskView)
            .where(SavedTaskView.user_id == current.id, SavedTaskView.is_default == True, SavedTaskView.id != view_id)
        )).scalars().all()
        for v in existing:
            v.is_default = False

    for field, value in changes.items():
        setattr(view, field, value)

    await db.commit()
    await db.refresh(view)
    return view


@router.delete("/views/saved/{view_id}")
async def delete_saved_view(
    view_id: uuid_mod.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    view = (await db.execute(
        select(SavedTaskView).where(SavedTaskView.id == view_id, SavedTaskView.user_id == current.id)
    )).scalar_one_or_none()
    if not view:
        raise HTTPException(404, "Saved view not found")
    await db.delete(view)
    await db.commit()
    return {"message": "View deleted"}
