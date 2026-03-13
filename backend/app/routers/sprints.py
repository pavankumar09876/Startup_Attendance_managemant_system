from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date, datetime, timezone
import uuid

from app.database import get_db
from app.models.sprint import Sprint, SprintStatus
from app.models.project import Project, Task
from app.models.user import User, Role
from app.schemas.sprint import SprintCreate, SprintUpdate, SprintOut, CompleteSprintPayload
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(tags=["Sprints"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _sprint_to_dict(sprint: Sprint, task_list: list) -> dict:
    """Build a SprintOut-compatible dict with computed metrics."""
    total      = len(task_list)
    completed  = sum(1 for t in task_list if t.status.value == "done")
    total_pts  = sum(t.story_points or 0 for t in task_list)
    done_pts   = sum(t.story_points or 0 for t in task_list if t.status.value == "done")

    today = date.today()
    days_remaining = None
    burn_rate      = None
    velocity       = None

    if sprint.status == SprintStatus.ACTIVE and sprint.end_date:
        days_remaining = max(0, (sprint.end_date - today).days)
        if sprint.start_date:
            elapsed   = max(1, (today - sprint.start_date).days)
            burn_rate = round(done_pts / elapsed, 2)

    if sprint.status == SprintStatus.COMPLETED:
        velocity = done_pts

    return {
        "id":           sprint.id,
        "project_id":   sprint.project_id,
        "name":         sprint.name,
        "goal":         sprint.goal,
        "status":       sprint.status,
        "start_date":   sprint.start_date,
        "end_date":     sprint.end_date,
        "capacity":     sprint.capacity,
        "completed_at": sprint.completed_at,
        "created_at":   sprint.created_at,
        "total_tasks":               total,
        "completed_tasks":           completed,
        "completion_pct":            round(completed / total * 100, 1) if total else 0.0,
        "total_story_points":        total_pts,
        "completed_story_points":    done_pts,
        "velocity":                  velocity,
        "days_remaining":            days_remaining,
        "burn_rate":                 burn_rate,
    }


async def _load_tasks(sprint_id: uuid.UUID, db: AsyncSession) -> list:
    result = await db.execute(select(Task).where(Task.sprint_id == sprint_id))
    return result.scalars().all()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/sprints", response_model=List[SprintOut])
async def list_sprints(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Sprint)
        .where(Sprint.project_id == project_id)
        .order_by(Sprint.created_at)
    )
    sprints = result.scalars().all()
    out = []
    for s in sprints:
        tasks = await _load_tasks(s.id, db)
        out.append(_sprint_to_dict(s, tasks))
    return out


@router.post("/projects/{project_id}/sprints", response_model=SprintOut, status_code=201)
async def create_sprint(
    project_id: uuid.UUID,
    payload: SprintCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    proj = await db.get(Project, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    sprint = Sprint(project_id=project_id, **payload.model_dump())
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return _sprint_to_dict(sprint, [])


@router.patch("/sprints/{sprint_id}", response_model=SprintOut)
async def update_sprint(
    sprint_id: uuid.UUID,
    payload: SprintUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status == SprintStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot edit a completed sprint")

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(sprint, k, v)
    await db.commit()
    await db.refresh(sprint)
    tasks = await _load_tasks(sprint.id, db)
    return _sprint_to_dict(sprint, tasks)


@router.post("/sprints/{sprint_id}/start", response_model=SprintOut)
async def start_sprint(
    sprint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status != SprintStatus.PLANNED:
        raise HTTPException(status_code=400, detail="Only planned sprints can be started")

    # Enforce unique active sprint per project (app-level; DB partial index is the safety net)
    existing = await db.execute(
        select(Sprint).where(
            Sprint.project_id == sprint.project_id,
            Sprint.status     == SprintStatus.ACTIVE,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Another sprint is already active. Complete it before starting a new one.",
        )

    sprint.status = SprintStatus.ACTIVE
    await db.commit()
    await db.refresh(sprint)
    tasks = await _load_tasks(sprint.id, db)
    return _sprint_to_dict(sprint, tasks)


@router.post("/sprints/{sprint_id}/complete", response_model=SprintOut)
async def complete_sprint(
    sprint_id: uuid.UUID,
    payload: CompleteSprintPayload,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only active sprints can be completed")

    target_id = payload.move_incomplete_to_sprint_id
    if target_id:
        target = await db.get(Sprint, target_id)
        if not target or target.status != SprintStatus.PLANNED:
            raise HTTPException(status_code=400, detail="Target sprint must be a planned sprint")

    # Move incomplete tasks
    inc_result = await db.execute(
        select(Task).where(Task.sprint_id == sprint_id, Task.status != "done")
    )
    for t in inc_result.scalars().all():
        t.sprint_id = target_id  # None → backlog

    sprint.status       = SprintStatus.COMPLETED
    sprint.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sprint)
    tasks = await _load_tasks(sprint.id, db)
    return _sprint_to_dict(sprint, tasks)


@router.delete("/sprints/{sprint_id}", status_code=204)
async def delete_sprint(
    sprint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER)),
):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status == SprintStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Cannot delete an active sprint")

    # Move tasks back to backlog
    tasks_result = await db.execute(select(Task).where(Task.sprint_id == sprint_id))
    for t in tasks_result.scalars().all():
        t.sprint_id = None

    await db.delete(sprint)
    await db.commit()
