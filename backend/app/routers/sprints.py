from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from typing import List
from datetime import date, datetime, timezone
from collections import defaultdict
import uuid

from app.database import get_db
from app.models.sprint import Sprint, SprintStatus
from app.models.project import Project, Task, project_members
from app.models.user import User, Role
from app.models.leave import Leave, LeaveStatus
from app.schemas.sprint import (
    SprintCreate, SprintUpdate, SprintOut, CompleteSprintPayload,
    MemberWorkload, SprintWorkloadOut,
)
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

    over_capacity = False
    if sprint.capacity and total_pts > sprint.capacity:
        over_capacity = True

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
        "over_capacity":             over_capacity,
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


# ── Team workload per sprint ─────────────────────────────────────────────────

@router.get("/sprints/{sprint_id}/workload", response_model=SprintWorkloadOut)
async def get_sprint_workload(
    sprint_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    sprint = await db.get(Sprint, sprint_id)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    # Load tasks with assignee info
    result = await db.execute(
        select(Task)
        .options(joinedload(Task.assignee))
        .where(Task.sprint_id == sprint_id)
    )
    tasks = result.unique().scalars().all()

    # Load project members
    members_result = await db.execute(
        select(User)
        .join(project_members, project_members.c.user_id == User.id)
        .where(project_members.c.project_id == sprint.project_id)
    )
    all_members = members_result.scalars().all()

    # Build per-member workload
    member_tasks: dict[uuid.UUID, list] = defaultdict(list)
    unassigned_pts = 0
    unassigned_count = 0
    for t in tasks:
        if t.assignee_id:
            member_tasks[t.assignee_id].append(t)
        else:
            unassigned_pts += t.story_points or 0
            unassigned_count += 1

    # Check approved leaves overlapping the sprint window
    leave_days: dict[uuid.UUID, int] = {}
    if sprint.start_date and sprint.end_date:
        leave_result = await db.execute(
            select(Leave).where(
                Leave.status == LeaveStatus.APPROVED,
                Leave.start_date <= sprint.end_date,
                Leave.end_date >= sprint.start_date,
            )
        )
        for lv in leave_result.scalars().all():
            # Count overlapping days
            overlap_start = max(lv.start_date, sprint.start_date)
            overlap_end = min(lv.end_date, sprint.end_date)
            days = (overlap_end - overlap_start).days + 1
            if days > 0:
                leave_days[lv.employee_id] = leave_days.get(lv.employee_id, 0) + days

    sprint_total_days = 0
    if sprint.start_date and sprint.end_date:
        sprint_total_days = max(1, (sprint.end_date - sprint.start_date).days + 1)

    workload_members = []
    for member in all_members:
        m_tasks = member_tasks.get(member.id, [])
        m_pts = sum(t.story_points or 0 for t in m_tasks)
        m_done = sum(1 for t in m_tasks if t.status.value == "done")
        m_leave = leave_days.get(member.id, 0)
        available_days = max(0, sprint_total_days - m_leave) if sprint_total_days else None

        workload_members.append(MemberWorkload(
            user_id=member.id,
            name=f"{member.first_name} {member.last_name}".strip() or member.email,
            avatar=member.avatar_url if hasattr(member, "avatar_url") else None,
            task_count=len(m_tasks),
            story_points=m_pts,
            completed_tasks=m_done,
            leave_days=m_leave,
            available_days=available_days,
        ))

    # Sort: most loaded first
    workload_members.sort(key=lambda m: m.story_points, reverse=True)

    total_pts = sum(t.story_points or 0 for t in tasks)
    return SprintWorkloadOut(
        sprint_id=sprint.id,
        capacity=sprint.capacity,
        total_story_points=total_pts,
        over_capacity=bool(sprint.capacity and total_pts > sprint.capacity),
        unassigned_points=unassigned_pts,
        unassigned_tasks=unassigned_count,
        members=workload_members,
    )
