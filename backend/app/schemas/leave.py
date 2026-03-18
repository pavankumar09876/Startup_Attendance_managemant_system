from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import date, datetime
from app.models.leave import LeaveType, LeaveStatus


class LeaveCreate(BaseModel):
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str
    is_half_day: bool = False
    half_day_period: Optional[str] = None  # "first_half" or "second_half"
    comp_off_date: Optional[date] = None   # Required if leave_type == comp_off


class LeaveUpdate(BaseModel):
    status: LeaveStatus
    rejection_reason: Optional[str] = None


class LeaveOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    leave_type: LeaveType
    start_date: date
    end_date: date
    total_days: float
    reason: str
    status: LeaveStatus
    is_half_day: bool = False
    half_day_period: Optional[str] = None
    comp_off_date: Optional[date] = None
    reviewed_by: Optional[UUID4] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeaveEncashmentRequest(BaseModel):
    leave_type: LeaveType
    days: float


class LeaveEncashmentOut(BaseModel):
    employee_id: UUID4
    leave_type: LeaveType
    days: float
    daily_salary: float
    amount: float
    status: str


class LeaveBalanceOut(BaseModel):
    leave_type: str
    total: float
    used: float
    remaining: float


class HolidayOut(BaseModel):
    id: UUID4
    name: str
    date: date
    type: str
    description: Optional[str] = None

    class Config:
        from_attributes = True
