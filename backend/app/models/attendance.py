from sqlalchemy import Column, String, Date, Time, DateTime, ForeignKey, Enum, Text, Numeric, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    HALF_DAY = "half_day"
    ON_LEAVE = "on_leave"
    HOLIDAY = "holiday"
    WEEKEND = "weekend"
    WFH = "wfh"


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint('employee_id', 'date', name='uq_attendance_employee_date'),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    check_in = Column(Time, nullable=True)
    check_out = Column(Time, nullable=True)
    # Break tracking
    break_start = Column(Time, nullable=True)
    break_end   = Column(Time, nullable=True)
    break_minutes = Column(Numeric(6, 2), nullable=True)   # total break duration
    on_break    = Column(Boolean, default=False)
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.ABSENT)
    working_hours = Column(Numeric(4, 2), nullable=True)   # net of breaks
    overtime_hours = Column(Numeric(4, 2), default=0)
    # Shift reference (which shift was active on this day)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("User", back_populates="attendance_records")
    shift    = relationship("Shift")
