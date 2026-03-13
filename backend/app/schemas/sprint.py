from pydantic import BaseModel, UUID4
from typing import Optional, List
from datetime import date, datetime

from app.models.sprint import SprintStatus


class SprintCreate(BaseModel):
    name:       str
    goal:       Optional[str]  = None
    start_date: Optional[date] = None
    end_date:   Optional[date] = None
    capacity:   Optional[int]  = None


class SprintUpdate(BaseModel):
    name:       Optional[str]  = None
    goal:       Optional[str]  = None
    start_date: Optional[date] = None
    end_date:   Optional[date] = None
    capacity:   Optional[int]  = None


class SprintOut(BaseModel):
    id:           UUID4
    project_id:   UUID4
    name:         str
    goal:         Optional[str]      = None
    status:       SprintStatus
    start_date:   Optional[date]     = None
    end_date:     Optional[date]     = None
    capacity:     Optional[int]      = None
    completed_at: Optional[datetime] = None
    created_at:   datetime

    # Computed metrics
    total_tasks:               int   = 0
    completed_tasks:           int   = 0
    completion_pct:            float = 0.0
    total_story_points:        int   = 0
    completed_story_points:    int   = 0
    velocity:      Optional[int]   = None   # completed sprints
    days_remaining: Optional[int]  = None   # active sprints
    burn_rate:     Optional[float] = None   # pts/day, active sprints

    class Config:
        from_attributes = True


class CompleteSprintPayload(BaseModel):
    move_incomplete_to_sprint_id: Optional[UUID4] = None   # None → backlog
