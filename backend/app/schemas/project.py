from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import date, datetime
from app.models.project import ProjectStatus, TaskStatus, TaskPriority


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.PLANNING
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[UUID4] = None
    member_ids: Optional[List[UUID4]] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[UUID4] = None
    progress: Optional[int] = None


class ProjectOut(BaseModel):
    id: UUID4
    name: str
    description: Optional[str] = None
    status: ProjectStatus
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[UUID4] = None
    progress: int
    created_at: datetime

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    project_id: UUID4
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: Optional[UUID4] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[UUID4] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[int] = None


class TaskOut(BaseModel):
    id: UUID4
    project_id: UUID4
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    assignee_id: Optional[UUID4] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
