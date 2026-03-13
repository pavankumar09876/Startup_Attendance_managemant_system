from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text, Float, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class CompanySettings(Base):
    """Singleton row — always id='00000000-0000-0000-0000-000000000001'."""
    __tablename__ = "company_settings"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name            = Column(String(200), nullable=False, default="My Company")
    logo_url        = Column(String(500), nullable=True)
    industry        = Column(String(100), nullable=True)
    size            = Column(String(50), nullable=True)
    founded_year    = Column(Integer, nullable=True)
    address         = Column(Text, nullable=True)
    city            = Column(String(100), nullable=True)
    state           = Column(String(100), nullable=True)
    country         = Column(String(100), nullable=True)
    timezone        = Column(String(100), default="Asia/Kolkata")
    working_days    = Column(JSON, default=lambda: [0, 1, 2, 3, 4])   # 0=Mon
    work_start_time = Column(String(5), default="09:00")
    work_end_time   = Column(String(5), default="18:00")
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())


class AttendanceConfig(Base):
    """Singleton row for attendance rules."""
    __tablename__ = "attendance_config"

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grace_period_minutes    = Column(Integer, default=10)
    half_day_threshold_hours = Column(Float, default=4.0)
    overtime_after_hours    = Column(Float, default=8.0)
    geofence_radius_meters  = Column(Integer, default=200)
    office_lat              = Column(Float, nullable=True)
    office_lng              = Column(Float, nullable=True)
    allow_wfh               = Column(Boolean, default=True)
    require_selfie          = Column(Boolean, default=False)
    auto_mark_absent        = Column(Boolean, default=False)
    auto_absent_after_time  = Column(String(5), default="11:00")
    updated_at              = Column(DateTime(timezone=True), onupdate=func.now())


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name            = Column(String(100), nullable=False)
    days_per_year   = Column(Integer, nullable=False)
    carry_forward   = Column(Boolean, default=False)
    max_carry_days  = Column(Integer, default=0)
    is_paid         = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role        = Column(String(50), nullable=False, index=True)
    module      = Column(String(50), nullable=False)
    can_view    = Column(Boolean, default=False)
    can_create  = Column(Boolean, default=False)
    can_edit    = Column(Boolean, default=False)
    can_delete  = Column(Boolean, default=False)
    can_approve = Column(Boolean, default=False)
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id                              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id                         = Column(String(50), nullable=False, unique=True, index=True)
    leave_approved_email            = Column(Boolean, default=True)
    leave_approved_inapp            = Column(Boolean, default=True)
    leave_rejected_email            = Column(Boolean, default=True)
    leave_rejected_inapp            = Column(Boolean, default=True)
    task_assigned_email             = Column(Boolean, default=True)
    task_assigned_inapp             = Column(Boolean, default=True)
    payslip_ready_email             = Column(Boolean, default=True)
    payslip_ready_inapp             = Column(Boolean, default=True)
    attendance_regularization_inapp = Column(Boolean, default=True)
    project_deadline_email          = Column(Boolean, default=True)
    project_deadline_inapp          = Column(Boolean, default=True)
    birthday_reminder_inapp         = Column(Boolean, default=False)
    updated_at                      = Column(DateTime(timezone=True), onupdate=func.now())
