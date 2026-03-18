from fastapi import APIRouter, Depends, HTTPException, Query,status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.orm import selectinload
from typing import Optional
from decimal import Decimal
import uuid

from app.database import get_db
from app.models.project import Project, Task, TaskActivity, ProjectStatus, ProjectPriority, ProjectRole, TaskStatus, IssueType, project_members
from app.models.user import User, Role
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectOut,
    TaskCreate, TaskUpdate, TaskOut,
    AddMemberRequest, UpdateMemberRoleRequest, ProjectMemberOut,
)
from app.utils.dependencies import get_current_user, require_roles, require_permission

router = APIRouter(prefix="/projects", tags=["Projects"])

ADMIN_ROLES = {Role.SUPER_ADMIN, Role.ADMIN}

# Roles that can manage project (add/remove members, create/delete tasks, manage sprints)
MANAGE_ROLES = {ProjectRole.OWNER, ProjectRole.MANAGER}
# Roles that can contribute (create tasks, update own tasks)
CONTRIBUTE_ROLES = {ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR}

VALID_PROJECT_ROLES = {r.value for r in ProjectRole}


# ── Role helpers ─────────────────────────────────────────────────────────────

async def _get_member_role(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID,
) -> Optional[str]:
    """Return the user's role in this project, or None if not a member."""
    row = (await db.execute(
        select(project_members.c.role).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    )).scalar_one_or_none()
    return row


async def _can_view(db: AsyncSession, project_id: uuid.UUID, user: User) -> bool:
    """Any member (including viewer) or admin can view."""
    if user.role in ADMIN_ROLES:
        return True
    role = await _get_member_role(db, project_id, user.id)
    return role is not None


async def _can_contribute(db: AsyncSession, project_id: uuid.UUID, user: User) -> bool:
    """Owner, manager, or contributor can create/edit tasks."""
    if user.role in ADMIN_ROLES:
        return True
    role = await _get_member_role(db, project_id, user.id)
    return role in {r.value for r in CONTRIBUTE_ROLES}


async def _can_manage(db: AsyncSession, project_id: uuid.UUID, user: User) -> bool:
    """Owner or manager can manage members, sprints, delete tasks."""
    if user.role in ADMIN_ROLES:
        return True
    role = await _get_member_role(db, project_id, user.id)
    return role in {r.value for r in MANAGE_ROLES}


async def _is_owner(db: AsyncSession, project_id: uuid.UUID, user: User) -> bool:
    """Only owner can change other managers or delete project."""
    if user.role in ADMIN_ROLES:
        return True
    role = await _get_member_role(db, project_id, user.id)
    return role == ProjectRole.OWNER.value


async def _check_task_edit(
    db: AsyncSession, task: Task, user: User,
) -> bool:
    """Contributor+ can edit their own tasks; manager+ can edit any task."""
    if user.role in ADMIN_ROLES:
        return True
    role = await _get_member_role(db, task.project_id, user.id)
    if not role:
        return False
    # Manager/owner can edit any task
    if role in {ProjectRole.OWNER.value, ProjectRole.MANAGER.value}:
        return True
    # Contributor can edit tasks assigned to them
    if role == ProjectRole.CONTRIBUTOR.value and task.assignee_id == user.id:
        return True
    return False


async def _check_task_delete(
    db: AsyncSession, task: Task, user: User,
) -> bool:
    """Only manager+ or admin can delete tasks."""
    if user.role in ADMIN_ROLES:
        return True
    role = await _get_member_role(db, task.project_id, user.id)
    return role in {ProjectRole.OWNER.value, ProjectRole.MANAGER.value}


class ProjectListOut(ProjectOut):
    manager_name: Optional[str] = None
    manager_avatar: Optional[str] = None
    total_tasks: int = 0
    completed_tasks: int = 0
    member_count: int = 0


class PaginatedProjects(BaseModel):
    projects: list[ProjectListOut]
    total: int = 0


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedProjects)
async def list_projects(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Project).options(selectinload(Project.manager))
    if status:
        q = q.where(Project.status == ProjectStatus(status))
    if search:
        q = q.where(Project.name.ilike(f"%{search}%"))
    q = q.order_by(Project.created_at.desc())

    # Count
    count_q = select(func.count(Project.id))
    if status:
        count_q = count_q.where(Project.status == ProjectStatus(status))
    if search:
        count_q = count_q.where(Project.name.ilike(f"%{search}%"))
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(q.offset(skip).limit(limit))
    projects = result.scalars().all()

    # Batch-fetch task counts and member counts
    proj_ids = [p.id for p in projects]
    task_counts = {}
    member_counts = {}
    if proj_ids:
        tc = await db.execute(
            select(
                Task.project_id,
                func.count().label("total"),
                func.count().filter(Task.status == TaskStatus.DONE).label("done"),
            ).where(Task.project_id.in_(proj_ids)).group_by(Task.project_id)
        )
        for row in tc.all():
            task_counts[row.project_id] = (row.total, row.done)

        mc = await db.execute(
            select(
                project_members.c.project_id,
                func.count().label("cnt"),
            ).where(project_members.c.project_id.in_(proj_ids)).group_by(project_members.c.project_id)
        )
        for row in mc.all():
            member_counts[row.project_id] = row.cnt

    out = []
    for p in projects:
        d = ProjectListOut.model_validate(p)
        if p.manager:
            d.manager_name = f"{p.manager.first_name} {p.manager.last_name}"
            d.manager_avatar = p.manager.avatar_url
        tc_data = task_counts.get(p.id, (0, 0))
        d.total_tasks = tc_data[0]
        d.completed_tasks = tc_data[1]
        d.member_count = member_counts.get(p.id, 0)
        out.append(d)

    return PaginatedProjects(projects=out, total=total)


@router.post("/", response_model=ProjectOut, status_code=201)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("project:create")),
):
    data = payload.model_dump(exclude={"member_ids", "members"})
    project = Project(**data)
    # Default manager to creator if not specified
    if not project.manager_id:
        project.manager_id = current_user.id
    db.add(project)
    await db.flush()

    # Always add the creator as owner
    await db.execute(project_members.insert().values(
        project_id=project.id, user_id=current_user.id, role=ProjectRole.OWNER.value,
    ))

    # Add members from either members list or member_ids
    member_user_ids: dict[uuid.UUID, str] = {}
    if payload.members:
        for m in payload.members:
            if m.user_id != current_user.id:
                role = m.role if m.role in VALID_PROJECT_ROLES else ProjectRole.CONTRIBUTOR.value
                member_user_ids[m.user_id] = role
    if payload.member_ids:
        for uid in payload.member_ids:
            if uid != current_user.id and uid not in member_user_ids:
                member_user_ids[uid] = ProjectRole.CONTRIBUTOR.value

    for uid, role in member_user_ids.items():
        await db.execute(project_members.insert().values(
            project_id=project.id, user_id=uid, role=role,
        ))

    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await _can_manage(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Only project owners/managers can update projects")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await _is_owner(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Only project owners or admins can delete projects")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


# ── Members ───────────────────────────────────────────────────────────────────

@router.get("/{project_id}/members", response_model=list[ProjectMemberOut])
async def list_members(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all members of a project with their roles."""
    if not await _can_view(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(
            User.id,
            User.id.label("user_id"),
            (User.first_name + " " + User.last_name).label("name"),
            User.avatar_url.label("avatar"),
            User.department,
            project_members.c.role.label("role_in_project"),
        )
        .select_from(project_members)
        .join(User, User.id == project_members.c.user_id)
        .where(project_members.c.project_id == project_id)
    )
    rows = result.all()
    return [
        ProjectMemberOut(
            id=row.id,
            user_id=row.user_id,
            name=row.name or "Unknown",
            avatar=row.avatar,
            department=row.department,
            role_in_project=row.role_in_project,
        )
        for row in rows
    ]


@router.post("/{project_id}/members", response_model=ProjectMemberOut, status_code=201)
async def add_member(
    project_id: uuid.UUID,
    payload: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a member to a project. Requires manager+ role."""
    if not await _can_manage(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Only project owners/managers can add members")

    role = payload.role_in_project
    if role not in VALID_PROJECT_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_PROJECT_ROLES)}")

    # Only owners can add managers
    if role in {ProjectRole.OWNER.value, ProjectRole.MANAGER.value}:
        if not await _is_owner(db, project_id, current_user):
            raise HTTPException(status_code=403, detail="Only project owners can assign owner/manager roles")

    # Check project exists
    proj = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check user exists
    target_user = (await db.execute(
        select(User).where(User.id == payload.user_id, User.is_active == True)
    )).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found or inactive")

    # Check not already a member
    existing = (await db.execute(
        select(project_members.c.user_id).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == payload.user_id,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="User is already a project member")

    await db.execute(project_members.insert().values(
        project_id=project_id, user_id=payload.user_id, role=role,
    ))
    await db.commit()

    return ProjectMemberOut(
        id=target_user.id,
        user_id=target_user.id,
        name=f"{target_user.first_name} {target_user.last_name}",
        avatar=target_user.avatar_url,
        department=target_user.department,
        role_in_project=role,
    )


@router.patch("/{project_id}/members/{user_id}", response_model=ProjectMemberOut)
async def update_member_role(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: UpdateMemberRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a member's role. Owner can change anyone; manager can change contributor/viewer."""
    new_role = payload.role_in_project
    if new_role not in VALID_PROJECT_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_PROJECT_ROLES)}")

    current_role = await _get_member_role(db, project_id, user_id)
    if not current_role:
        raise HTTPException(status_code=404, detail="Member not found in project")

    is_admin = current_user.role in ADMIN_ROLES
    caller_role = await _get_member_role(db, project_id, current_user.id)

    # Only owner/admin can promote to owner/manager
    if new_role in {ProjectRole.OWNER.value, ProjectRole.MANAGER.value}:
        if not (is_admin or caller_role == ProjectRole.OWNER.value):
            raise HTTPException(status_code=403, detail="Only owners can assign owner/manager roles")

    # Manager can only change contributor/viewer roles
    if caller_role == ProjectRole.MANAGER.value and not is_admin:
        if current_role in {ProjectRole.OWNER.value, ProjectRole.MANAGER.value}:
            raise HTTPException(status_code=403, detail="Managers cannot change owner/manager roles")

    # Cannot demote yourself if you're the only owner
    if user_id == current_user.id and current_role == ProjectRole.OWNER.value and new_role != ProjectRole.OWNER.value:
        owner_count = (await db.execute(
            select(func.count()).select_from(project_members).where(
                project_members.c.project_id == project_id,
                project_members.c.role == ProjectRole.OWNER.value,
            )
        )).scalar() or 0
        if owner_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last owner. Transfer ownership first.")

    await db.execute(
        project_members.update()
        .where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
        .values(role=new_role)
    )
    await db.commit()

    target_user = (await db.execute(select(User).where(User.id == user_id))).scalar_one()
    return ProjectMemberOut(
        id=target_user.id,
        user_id=target_user.id,
        name=f"{target_user.first_name} {target_user.last_name}",
        avatar=target_user.avatar_url,
        department=target_user.department,
        role_in_project=new_role,
    )


@router.delete("/{project_id}/members/{user_id}", status_code=204)
async def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a member from a project. Manager+ can remove contributor/viewer; owner can remove anyone."""
    target_role = await _get_member_role(db, project_id, user_id)
    if not target_role:
        raise HTTPException(status_code=404, detail="Member not found in project")

    is_admin = current_user.role in ADMIN_ROLES

    # Self-removal is always allowed (except last owner)
    if user_id == current_user.id:
        if target_role == ProjectRole.OWNER.value:
            owner_count = (await db.execute(
                select(func.count()).select_from(project_members).where(
                    project_members.c.project_id == project_id,
                    project_members.c.role == ProjectRole.OWNER.value,
                )
            )).scalar() or 0
            if owner_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot leave as the last owner. Transfer ownership first.")
    else:
        # Removing someone else — need manager+ role
        if not await _can_manage(db, project_id, current_user):
            raise HTTPException(status_code=403, detail="Only project owners/managers can remove members")
        # Manager cannot remove owner/manager
        caller_role = await _get_member_role(db, project_id, current_user.id)
        if not is_admin and caller_role == ProjectRole.MANAGER.value:
            if target_role in {ProjectRole.OWNER.value, ProjectRole.MANAGER.value}:
                raise HTTPException(status_code=403, detail="Managers cannot remove owners or other managers")

    await db.execute(
        project_members.delete().where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    )
    await db.commit()


# ── Tasks ─────────────────────────────────────────────────────────────────────

@router.get("/{project_id}/tasks", response_model=list[TaskOut])
async def list_tasks(
    project_id: uuid.UUID,
    status:      Optional[str]       = None,
    priority:    Optional[str]       = None,
    assignee_id: Optional[uuid.UUID] = None,
    sprint_id:   Optional[uuid.UUID] = None,
    label:       Optional[str]       = Query(None, description="Filter by label"),
    issue_type:  Optional[str]       = None,
    search:      Optional[str]       = None,
    due_from:    Optional[str]       = Query(None, description="Due date >= (YYYY-MM-DD)"),
    due_to:      Optional[str]       = Query(None, description="Due date <= (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await _can_view(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    from datetime import date as date_type
    from app.models.project import IssueType, TaskPriority

    q = select(Task).where(Task.project_id == project_id)

    if status:
        q = q.where(Task.status == TaskStatus(status))
    if priority:
        q = q.where(Task.priority == TaskPriority(priority))
    if assignee_id:
        q = q.where(Task.assignee_id == assignee_id)
    if sprint_id:
        q = q.where(Task.sprint_id == sprint_id)
    if label:
        q = q.where(Task.labels.any(label))
    if issue_type:
        q = q.where(Task.issue_type == IssueType(issue_type))
    if search:
        q = q.where(Task.title.ilike(f"%{search}%"))
    if due_from:
        q = q.where(Task.due_date >= date_type.fromisoformat(due_from))
    if due_to:
        q = q.where(Task.due_date <= date_type.fromisoformat(due_to))

    q = q.order_by(Task.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/{project_id}/tasks", response_model=TaskOut, status_code=201)
async def create_task(
    project_id: uuid.UUID,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await _can_contribute(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Only contributors and above can create tasks")

    # Validate epic_id if provided
    if payload.epic_id:
        from app.routers.tasks_global import _validate_epic_assignment
        # Use a dummy task_id (None) since task doesn't exist yet
        epic = (await db.execute(select(Task).where(Task.id == payload.epic_id))).scalar_one_or_none()
        if not epic:
            raise HTTPException(404, "Epic not found")
        if epic.issue_type != IssueType.EPIC:
            raise HTTPException(400, "Target task is not an epic")

    task = Task(**payload.model_dump(), project_id=project_id)
    db.add(task)
    await db.flush()
    # Log creation activity
    actor_name = f"{current_user.first_name} {current_user.last_name}"
    db.add(TaskActivity(
        task_id=task.id, actor_id=current_user.id, actor_name=actor_name,
        action="created",
    ))
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not await _check_task_edit(db, task, current_user):
        raise HTTPException(status_code=403, detail="You don't have permission to edit this task")

    from app.routers.tasks_global import TRACKED_FIELDS, FIELD_LABELS, check_dependencies_met, _validate_epic_assignment

    # Enforce dependencies before allowing status progression
    changes = payload.model_dump(exclude_none=True)
    if "status" in changes:
        await check_dependencies_met(db, task_id, TaskStatus(changes["status"]))

    # Validate epic assignment
    if "epic_id" in changes:
        await _validate_epic_assignment(db, task_id, changes["epic_id"])

    actor_name = f"{current_user.first_name} {current_user.last_name}"

    for field, value in payload.model_dump(exclude_none=True).items():
        old_val = getattr(task, field, None)
        old_str = old_val.value if hasattr(old_val, 'value') else str(old_val) if old_val is not None else None
        new_str = value.value if hasattr(value, 'value') else str(value) if value is not None else None
        if old_str != new_str and field in TRACKED_FIELDS:
            db.add(TaskActivity(
                task_id=task_id, actor_id=current_user.id, actor_name=actor_name,
                action="updated", field=FIELD_LABELS.get(field, field),
                old_value=old_str, new_value=new_str,
            ))
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not await _check_task_delete(db, task, current_user):
        raise HTTPException(status_code=403, detail="Only project managers/owners or admins can delete tasks")
    await db.delete(task)
    await db.commit()
