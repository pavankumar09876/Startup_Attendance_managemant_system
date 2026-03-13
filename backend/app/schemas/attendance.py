from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import date, time, datetime
from decimal import Decimal
from app.models.attendance import AttendanceStatus


class AttendanceCreate(BaseModel):
    employee_id: UUID4
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    status: AttendanceStatus = AttendanceStatus.PRESENT
    notes: Optional[str] = None


class AttendanceUpdate(BaseModel):
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    status: Optional[AttendanceStatus] = None
    notes: Optional[str] = None


class AttendanceOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    date: date
    check_in: Optional[time] = None
    check_out: Optional[time] = None
    status: AttendanceStatus
    working_hours: Optional[Decimal] = None
    overtime_hours: Optional[Decimal] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AttendanceSummary(BaseModel):
    total_days: int
    present: int
    absent: int
    late: int
    half_day: int
    on_leave: int
    avg_working_hours: float
