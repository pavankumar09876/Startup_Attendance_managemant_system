from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.models.project import ProjectStatus, ProjectPriority, TaskStatus, TaskPriority, IssueType


class ProjectMemberInput(BaseModel):
    user_id: UUID4
    role: str = "contributor"


class AddMemberRequest(BaseModel):
    user_id: UUID4
    role_in_project: str = "contributor"


class UpdateMemberRoleRequest(BaseModel):
    role_in_project: str


class ProjectMemberOut(BaseModel):
    id: UUID4
    user_id: UUID4
    name: str
    avatar: Optional[str] = None
    department: Optional[str] = None
    role_in_project: str


class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: ProjectPriority = ProjectPriority.MEDIUM
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    manager_id: Optional[UUID4] = None
    member_ids: Optional[List[UUID4]] = []
    members: Optional[List[ProjectMemberInput]] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    manager_id: Optional[UUID4] = None
    progress: Optional[int] = None


class ProjectOut(BaseModel):
    id: UUID4
    name: str
    client_name: Optional[str] = None
    description: Optional[str] = None
    status: ProjectStatus
    priority: Optional[ProjectPriority] = ProjectPriority.MEDIUM
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    spent: Optional[Decimal] = None
    manager_id: Optional[UUID4] = None
    progress: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    project_id: UUID4
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    issue_type: IssueType = IssueType.TASK
    assignee_id: Optional[UUID4] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[int] = None
    sprint_id: Optional[UUID4] = None
    story_points: Optional[int] = None
    parent_id: Optional[UUID4] = None
    epic_id: Optional[UUID4] = None
    labels: List[str] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    issue_type: Optional[IssueType] = None
    assignee_id: Optional[UUID4] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[int] = None
    sprint_id: Optional[UUID4] = None
    story_points: Optional[int] = None
    epic_id: Optional[UUID4] = None
    labels: Optional[List[str]] = None


class TaskOut(BaseModel):
    id: UUID4
    project_id: UUID4
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    issue_type: IssueType = IssueType.TASK
    assignee_id: Optional[UUID4] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[int] = None
    sprint_id: Optional[UUID4] = None
    story_points: Optional[int] = None
    parent_id: Optional[UUID4] = None
    epic_id: Optional[UUID4] = None
    epic_title: Optional[str] = None
    labels: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Task Comments ────────────────────────────────────────────────────────────
class TaskCommentCreate(BaseModel):
    content: str


class TaskCommentOut(BaseModel):
    id: UUID4
    task_id: UUID4
    user_id: UUID4
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Task Dependencies ────────────────────────────────────────────────────────
class TaskDependencyCreate(BaseModel):
    blocking_task_id: UUID4


class TaskDependencyOut(BaseModel):
    id: UUID4
    task_id: UUID4
    blocking_task_id: UUID4
    created_at: datetime

    class Config:
        from_attributes = True


# ── Task Activity ────────────────────────────────────────────────────────────
class TaskActivityOut(BaseModel):
    id: UUID4
    task_id: UUID4
    actor_id: UUID4
    actor_name: str
    action: str
    field: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Recurring Tasks ──────────────────────────────────────────────────────────
class RecurringTaskCreate(BaseModel):
    project_id: UUID4
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: Optional[UUID4] = None
    recurrence_rule: str  # daily, weekly, biweekly, monthly


class RecurringTaskOut(BaseModel):
    id: UUID4
    project_id: UUID4
    title: str
    description: Optional[str] = None
    priority: TaskPriority
    assignee_id: Optional[UUID4] = None
    recurrence_rule: str
    is_active: bool
    last_created_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Time Logs ────────────────────────────────────────────────────────────────
class TimeLogCreate(BaseModel):
    hours: float
    description: Optional[str] = None
    date: date


class TimeLogOut(BaseModel):
    id: UUID4
    task_id: UUID4
    user_id: UUID4
    user_name: str = ""
    hours: float
    description: Optional[str] = None
    date: date
    created_at: datetime

    class Config:
        from_attributes = True


# ── Saved Task Views ────────────────────────────────────────────────────────
class SavedTaskViewCreate(BaseModel):
    name: str
    filters: dict  # {status, priority, label, due, issue_type, due_from, due_to, ...}
    is_default: bool = False


class SavedTaskViewUpdate(BaseModel):
    name: Optional[str] = None
    filters: Optional[dict] = None
    is_default: Optional[bool] = None
    position: Optional[int] = None


class SavedTaskViewOut(BaseModel):
    id: UUID4
    user_id: UUID4
    name: str
    filters: dict
    is_default: bool
    position: int
    created_at: datetime

    class Config:
        from_attributes = True
