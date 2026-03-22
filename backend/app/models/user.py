from sqlalchemy import Column, String, Boolean, Enum, DateTime, ForeignKey, Numeric, Text, Date, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class Role(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    HR = "hr"
    MANAGER = "manager"
    EMPLOYEE = "employee"


class EmployeeStatus(str, enum.Enum):
    OFFER_SENT     = "offer_sent"       # Offer letter sent
    OFFER_ACCEPTED = "offer_accepted"   # Candidate accepted offer
    PRE_ONBOARDING = "pre_onboarding"   # Documents / BGV in progress
    JOINED         = "joined"           # Day-1 completed
    INVITED        = "invited"          # Legacy: account created, hasn't logged in
    ACTIVE         = "active"           # Normal working employee
    TRAINING       = "training"         # In training period
    BENCH          = "bench"            # Waiting for project allocation
    SUSPENDED      = "suspended"        # Temporarily suspended
    TERMINATED     = "terminated"       # No longer with company


class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)
    type = Column(String(20), nullable=True, default="Other")       # IT, Non-IT, Other
    head_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employees = relationship("User", back_populates="department", foreign_keys="[User.department_id]")
    head = relationship("User", foreign_keys="[Department.head_id]", lazy="joined")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(String(50), unique=True, nullable=False)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(Role), default=Role.EMPLOYEE, nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    designation = Column(String(100), nullable=True)
    date_of_joining = Column(DateTime(timezone=True), nullable=True)
    salary = Column(Numeric(12, 2), nullable=True)
    hra = Column(Numeric(12, 2), nullable=True)
    allowances = Column(Numeric(12, 2), nullable=True)
    bank_account = Column(String(50), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact = Column(String(50), nullable=True)
    employment_type = Column(String(20), nullable=True, default="full_time")
    work_location = Column(String(20), nullable=True, default="office")
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    status = Column(Enum(EmployeeStatus, values_callable=lambda x: [e.value for e in x]), default=EmployeeStatus.ACTIVE, nullable=False)
    termination_date = Column(Date, nullable=True)
    termination_reason = Column(Text, nullable=True)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspension_reason = Column(Text, nullable=True)
    must_change_password = Column(Boolean, default=False, nullable=False)
    password_reset_token = Column(String(255), nullable=True, index=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    revoked_all_before = Column(DateTime(timezone=True), nullable=True)
    # MFA fields
    mfa_secret = Column(String(32), nullable=True)
    mfa_enabled = Column(Boolean, default=False)
    mfa_backup_codes = Column(Text, nullable=True)  # JSON array of hashed backup codes
    approval_limit = Column(Numeric(12, 2), nullable=True)  # Max expense amount this user can approve
    # Onboarding / invite fields
    invite_token = Column(String(255), nullable=True, index=True)
    invite_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    invite_accepted_at = Column(DateTime(timezone=True), nullable=True)
    offer_sent_at = Column(DateTime(timezone=True), nullable=True)
    offer_accepted_at = Column(DateTime(timezone=True), nullable=True)
    joined_at = Column(DateTime(timezone=True), nullable=True)
    onboarding_stage = Column(String(30), nullable=True)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    attendance_records = relationship("Attendance", back_populates="employee")
    leave_requests = relationship("Leave", back_populates="employee", foreign_keys="[Leave.employee_id]")
    assigned_tasks = relationship("Task", back_populates="assignee")
    shift = relationship("Shift", back_populates="employees")
    manager = relationship("User", foreign_keys=[manager_id], remote_side="User.id")


class PendingEmployeeRequestStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PendingEmployeeRequest(Base):
    """Maker-checker: HR creates request, Admin approves before account is created."""
    __tablename__ = "pending_employee_requests"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payload         = Column(Text, nullable=False)  # JSON of UserCreate data
    status          = Column(Enum(PendingEmployeeRequestStatus, values_callable=lambda x: [e.value for e in x]), default=PendingEmployeeRequestStatus.PENDING)
    requested_by    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reviewed_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    # Multi-step approval chain
    current_approval_level = Column(Integer, default=0)
    max_approval_level     = Column(Integer, default=1)
    approval_chain_config  = Column(Text, nullable=True)  # JSON: [{"level":1,"role":"manager"}, ...]
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at     = Column(DateTime(timezone=True), nullable=True)

    requester = relationship("User", foreign_keys=[requested_by])
    reviewer  = relationship("User", foreign_keys=[reviewed_by])
