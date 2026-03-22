"""Enterprise onboarding models: BGV, checklists, approval steps,
document requirements, status transitions, joining instructions."""

from sqlalchemy import (
    Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Date,
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────────

class BGVStatus(str, enum.Enum):
    PENDING           = "pending"
    IN_VERIFICATION   = "in_verification"
    CLEARED           = "cleared"
    FAILED            = "failed"


class BGVItemStatus(str, enum.Enum):
    PENDING        = "pending"
    IN_PROGRESS    = "in_progress"
    VERIFIED       = "verified"
    FAILED         = "failed"
    NOT_APPLICABLE = "not_applicable"


class BGVItemType:
    EMPLOYMENT_HISTORY = "employment_history"
    EDUCATION          = "education"
    CRIMINAL_RECORD    = "criminal_record"
    ADDRESS            = "address"
    IDENTITY           = "identity"

    ALL = [EMPLOYMENT_HISTORY, EDUCATION, CRIMINAL_RECORD, ADDRESS, IDENTITY]


class ApprovalStepStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED  = "skipped"


# ── Background Verification ───────────────────────────────────────────────────

class BackgroundVerification(Base):
    __tablename__ = "background_verifications"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status         = Column(SAEnum(BGVStatus), default=BGVStatus.PENDING)
    overall_result = Column(String(50), nullable=True)
    vendor_name    = Column(String(200), nullable=True)
    initiated_by   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    initiated_at   = Column(DateTime(timezone=True), nullable=True)
    completed_at   = Column(DateTime(timezone=True), nullable=True)
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    employee  = relationship("User", foreign_keys=[employee_id])
    initiator = relationship("User", foreign_keys=[initiated_by])
    items     = relationship("BGVItem", back_populates="bgv", cascade="all, delete-orphan")


class BGVItem(Base):
    __tablename__ = "bgv_items"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bgv_id      = Column(UUID(as_uuid=True), ForeignKey("background_verifications.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type   = Column(String(50), nullable=False)
    status      = Column(SAEnum(BGVItemStatus), default=BGVItemStatus.PENDING)
    result      = Column(Text, nullable=True)
    verified_by = Column(String(200), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    bgv = relationship("BackgroundVerification", back_populates="items")


# ── Onboarding Checklist Templates ────────────────────────────────────────────

class OnboardingChecklistTemplate(Base):
    __tablename__ = "onboarding_checklist_templates"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                 = Column(String(100), nullable=False, unique=True)
    description          = Column(Text, nullable=True)
    target_role          = Column(String(50), nullable=True)
    target_department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_active            = Column(Boolean, default=True)
    created_by           = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), nullable=True)

    items      = relationship("ChecklistTemplateItem", back_populates="template", cascade="all, delete-orphan")
    creator    = relationship("User", foreign_keys=[created_by])
    department = relationship("Department", foreign_keys=[target_department_id])


class ChecklistTemplateItem(Base):
    __tablename__ = "checklist_template_items"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id   = Column(UUID(as_uuid=True), ForeignKey("onboarding_checklist_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    title         = Column(String(200), nullable=False)
    description   = Column(Text, nullable=True)
    category      = Column(String(50), default="general")
    assignee_role = Column(String(50), default="hr")
    sort_order    = Column(Integer, default=0)
    is_required   = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    template = relationship("OnboardingChecklistTemplate", back_populates="items")


# ── Per-Employee Checklist Items ──────────────────────────────────────────────

class EmployeeChecklistItem(Base):
    __tablename__ = "employee_checklist_items"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    template_item_id = Column(UUID(as_uuid=True), ForeignKey("checklist_template_items.id", ondelete="SET NULL"), nullable=True)
    title            = Column(String(200), nullable=False)
    description      = Column(Text, nullable=True)
    category         = Column(String(50), default="general")
    assignee_role    = Column(String(50), default="hr")
    assignee_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_completed     = Column(Boolean, default=False)
    completed_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    completed_at     = Column(DateTime(timezone=True), nullable=True)
    sort_order       = Column(Integer, default=0)
    is_required      = Column(Boolean, default=True)
    due_date         = Column(Date, nullable=True)
    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    employee      = relationship("User", foreign_keys=[employee_id])
    assignee      = relationship("User", foreign_keys=[assignee_id])
    completer     = relationship("User", foreign_keys=[completed_by])
    template_item = relationship("ChecklistTemplateItem")


# ── Multi-Step Employee Approval ──────────────────────────────────────────────

class EmployeeApprovalStep(Base):
    __tablename__ = "employee_approval_steps"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id    = Column(UUID(as_uuid=True), ForeignKey("pending_employee_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    level         = Column(Integer, nullable=False, default=1)
    approver_role = Column(String(50), nullable=False)
    approver_id   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status        = Column(SAEnum(ApprovalStepStatus), default=ApprovalStepStatus.PENDING)
    comment       = Column(Text, nullable=True)
    acted_at      = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    request  = relationship("PendingEmployeeRequest", backref="approval_steps")
    approver = relationship("User", foreign_keys=[approver_id])


# ── Document Requirements ─────────────────────────────────────────────────────

class DocumentRequirement(Base):
    __tablename__ = "document_requirements"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_type        = Column(String(50), nullable=False)
    name                 = Column(String(200), nullable=False)
    description          = Column(Text, nullable=True)
    target_role          = Column(String(50), nullable=True)
    target_department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_mandatory         = Column(Boolean, default=True)
    has_expiry           = Column(Boolean, default=False)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", foreign_keys=[target_department_id])


# ── Onboarding Status Transition Audit ────────────────────────────────────────

class OnboardingStatusTransition(Base):
    __tablename__ = "onboarding_status_transitions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    from_status     = Column(String(30), nullable=True)
    to_status       = Column(String(30), nullable=False)
    transitioned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    employee     = relationship("User", foreign_keys=[employee_id])
    transitioner = relationship("User", foreign_keys=[transitioned_by])


# ── Joining Instructions ──────────────────────────────────────────────────────

class JoiningInstruction(Base):
    __tablename__ = "joining_instructions"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name                 = Column(String(100), nullable=False)
    subject              = Column(String(200), nullable=False)
    body_html            = Column(Text, nullable=False)
    target_role          = Column(String(50), nullable=True)
    target_department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    is_active            = Column(Boolean, default=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), nullable=True)

    department = relationship("Department", foreign_keys=[target_department_id])


class EmployeeJoiningDetail(Base):
    __tablename__ = "employee_joining_details"

    id                         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id                = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    first_day_schedule         = Column(Text, nullable=True)
    reporting_location         = Column(String(200), nullable=True)
    reporting_time             = Column(String(20), nullable=True)
    reporting_manager_notified = Column(Boolean, default=False)
    joining_kit_sent           = Column(Boolean, default=False)
    instructions_sent_at       = Column(DateTime(timezone=True), nullable=True)
    created_at                 = Column(DateTime(timezone=True), server_default=func.now())
    updated_at                 = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("User", foreign_keys=[employee_id])


# ── SLA Configuration ────────────────────────────────────────────────────────

class OnboardingSLAConfig(Base):
    """Configurable SLA deadlines per onboarding stage."""
    __tablename__ = "onboarding_sla_configs"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stage           = Column(String(30), nullable=False, unique=True)
    max_days        = Column(Integer, nullable=False, default=7)
    escalation_role = Column(String(50), nullable=True, default="admin")
    auto_notify     = Column(Boolean, default=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), nullable=True)


class SLABreach(Base):
    """Records when an employee exceeds the SLA deadline for a stage."""
    __tablename__ = "sla_breaches"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stage         = Column(String(30), nullable=False)
    sla_days      = Column(Integer, nullable=False)
    actual_days   = Column(Integer, nullable=False)
    breached_at   = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at   = Column(DateTime(timezone=True), nullable=True)
    escalated_to  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes         = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    employee  = relationship("User", foreign_keys=[employee_id])
    escalatee = relationship("User", foreign_keys=[escalated_to])
