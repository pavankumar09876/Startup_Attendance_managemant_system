from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, Text, Float, JSON, Numeric, Date, ForeignKey,
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
    # IP whitelist for admin actions (JSON array of CIDR/IP strings, empty = no restriction)
    admin_ip_whitelist = Column(JSON, default=lambda: [])
    # Onboarding configuration
    bgv_required              = Column(Boolean, default=False)
    onboarding_stale_days     = Column(Integer, default=7)     # days before stale reminder
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
    # Reminder notification times (HH:MM, empty string = disabled)
    checkin_reminder_time   = Column(String(5), default="09:00")
    checkout_reminder_time  = Column(String(5), default="18:00")
    # Penalty configuration
    late_penalty_enabled    = Column(Boolean, default=False)
    late_penalty_amount     = Column(Numeric(10, 2), default=0)     # Fixed deduction per late day
    late_penalty_type       = Column(String(20), default="fixed")   # fixed, percentage
    absent_penalty_enabled  = Column(Boolean, default=False)
    absent_penalty_days     = Column(Numeric(4, 1), default=1)      # Days deducted per absent day (e.g., 1.5x)
    half_day_deduction_enabled = Column(Boolean, default=False)
    half_day_deduction_amount  = Column(Numeric(10, 2), default=0)  # Deduction for half-day
    max_late_days_before_deduction = Column(Integer, default=3)     # Grace: N late days allowed per month
    updated_at              = Column(DateTime(timezone=True), onupdate=func.now())


class LeavePolicy(Base):
    __tablename__ = "leave_policies"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name            = Column(String(100), nullable=False)
    days_per_year   = Column(Integer, nullable=False)
    carry_forward   = Column(Boolean, default=False)
    max_carry_days  = Column(Integer, default=0)
    is_paid         = Column(Boolean, default=True)
    # Enhanced leave policy fields
    sandwich_rule           = Column(Boolean, default=False)
    allow_half_day          = Column(Boolean, default=True)
    allow_negative_balance  = Column(Boolean, default=False)
    max_negative_days       = Column(Numeric(4, 1), default=0)
    encashment_allowed      = Column(Boolean, default=False)
    encashment_max_days     = Column(Integer, nullable=True)
    accrual_type            = Column(String(20), default="yearly")  # yearly, monthly, quarterly
    monthly_accrual_amount  = Column(Numeric(4, 1), nullable=True)  # e.g. 1.5 days/month
    probation_days_before_eligible = Column(Integer, default=0)
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


class Holiday(Base):
    __tablename__ = "holidays"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(200), nullable=False)
    date        = Column(Date, nullable=False, index=True)
    type        = Column(String(20), default="public")   # public, company
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id                              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id                         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
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
    checkin_reminder_inapp          = Column(Boolean, default=True)
    checkout_reminder_inapp         = Column(Boolean, default=True)
    updated_at                      = Column(DateTime(timezone=True), onupdate=func.now())
