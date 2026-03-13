from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import date, datetime
from app.models.leave import LeaveType, LeaveStatus


class LeaveCreate(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str


class LeaveUpdate(BaseModel):
    status: LeaveStatus
    rejection_reason: Optional[str] = None


class LeaveOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: int
    reason: str
    status: LeaveStatus
    reviewed_by: Optional[UUID4] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
