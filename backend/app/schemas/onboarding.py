"""Pydantic schemas for the enterprise onboarding module."""

from pydantic import BaseModel, UUID4, field_validator
from typing import Optional, List
from datetime import datetime, date

from app.models.onboarding import BGVStatus, BGVItemStatus, ApprovalStepStatus


# ── Status Transitions ─────────────────────────────────────────────────────────

class TransitionStatusPayload(BaseModel):
    new_status: str
    notes: Optional[str] = None


class OnboardingStatusTransitionOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    from_status: Optional[str] = None
    to_status: str
    transitioned_by: UUID4
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── BGV ────────────────────────────────────────────────────────────────────────

class BGVItemCreate(BaseModel):
    item_type: str
    notes: Optional[str] = None


class BGVItemUpdate(BaseModel):
    status: BGVItemStatus
    result: Optional[str] = None
    verified_by: Optional[str] = None
    notes: Optional[str] = None


class BGVItemOut(BaseModel):
    id: UUID4
    bgv_id: UUID4
    item_type: str
    status: BGVItemStatus
    result: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BGVCreate(BaseModel):
    vendor_name: Optional[str] = None
    notes: Optional[str] = None
    items: List[BGVItemCreate] = []


class BGVOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    status: BGVStatus
    overall_result: Optional[str] = None
    vendor_name: Optional[str] = None
    initiated_by: Optional[UUID4] = None
    initiated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[BGVItemOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Checklist Templates ────────────────────────────────────────────────────────

class ChecklistTemplateItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "general"
    assignee_role: str = "hr"
    sort_order: int = 0
    is_required: bool = True


class ChecklistTemplateItemOut(BaseModel):
    id: UUID4
    template_id: UUID4
    title: str
    description: Optional[str] = None
    category: str
    assignee_role: str
    sort_order: int
    is_required: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChecklistTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_role: Optional[str] = None
    target_department_id: Optional[UUID4] = None
    items: List[ChecklistTemplateItemCreate] = []

    @field_validator('target_department_id', mode='before')
    @classmethod
    def empty_uuid_to_none(cls, v):
        return None if v == '' or v is None else v


class ChecklistTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_role: Optional[str] = None
    target_department_id: Optional[UUID4] = None
    is_active: Optional[bool] = None

    @field_validator('target_department_id', mode='before')
    @classmethod
    def empty_uuid_to_none(cls, v):
        return None if v == '' or v is None else v


class ChecklistTemplateOut(BaseModel):
    id: UUID4
    name: str
    description: Optional[str] = None
    target_role: Optional[str] = None
    target_department_id: Optional[UUID4] = None
    is_active: bool
    items: List[ChecklistTemplateItemOut] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ── Per-Employee Checklist ─────────────────────────────────────────────────────

class EmployeeChecklistItemUpdate(BaseModel):
    is_completed: Optional[bool] = None
    notes: Optional[str] = None


class EmployeeChecklistItemOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    template_item_id: Optional[UUID4] = None
    title: str
    description: Optional[str] = None
    category: str
    assignee_role: str
    assignee_id: Optional[UUID4] = None
    is_completed: bool
    completed_by: Optional[UUID4] = None
    completed_at: Optional[datetime] = None
    sort_order: int
    is_required: bool
    due_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChecklistProgressOut(BaseModel):
    total: int
    completed: int
    required_total: int
    required_completed: int
    percentage: float


class EmployeeChecklistOut(BaseModel):
    items: List[EmployeeChecklistItemOut]
    progress: ChecklistProgressOut


# ── Multi-Step Approval ────────────────────────────────────────────────────────

class ApprovalChainStep(BaseModel):
    level: int
    role: str
    approver_id: Optional[UUID4] = None

    @field_validator('approver_id', mode='before')
    @classmethod
    def empty_uuid_to_none(cls, v):
        return None if v == '' or v is None else v


class EmployeeApprovalStepOut(BaseModel):
    id: UUID4
    request_id: UUID4
    level: int
    approver_role: str
    approver_id: Optional[UUID4] = None
    status: ApprovalStepStatus
    comment: Optional[str] = None
    acted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApproveStepPayload(BaseModel):
    comment: Optional[str] = None


class RejectStepPayload(BaseModel):
    reason: str


# ── Document Requirements ─────────────────────────────────────────────────────

class DocumentRequirementCreate(BaseModel):
    document_type: str
    name: str
    description: Optional[str] = None
    target_role: Optional[str] = None
    target_department_id: Optional[UUID4] = None
    is_mandatory: bool = True
    has_expiry: bool = False

    @field_validator('target_department_id', mode='before')
    @classmethod
    def empty_uuid_to_none(cls, v):
        return None if v == '' or v is None else v


class DocumentRequirementOut(BaseModel):
    id: UUID4
    document_type: str
    name: str
    description: Optional[str] = None
    target_role: Optional[str] = None
    target_department_id: Optional[UUID4] = None
    is_mandatory: bool
    has_expiry: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RequiredDocumentStatusOut(BaseModel):
    requirement: DocumentRequirementOut
    submitted: bool
    document_id: Optional[UUID4] = None
    verified: bool = False


# ── Joining Instructions ───────────────────────────────────────────────────────

class JoiningInstructionCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    target_role: Optional[str] = None
    target_department_id: Optional[UUID4] = None

    @field_validator('target_department_id', mode='before')
    @classmethod
    def empty_uuid_to_none(cls, v):
        return None if v == '' or v is None else v


class JoiningInstructionOut(BaseModel):
    id: UUID4
    name: str
    subject: str
    body_html: str
    target_role: Optional[str] = None
    target_department_id: Optional[UUID4] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EmployeeJoiningDetailCreate(BaseModel):
    first_day_schedule: Optional[str] = None
    reporting_location: Optional[str] = None
    reporting_time: Optional[str] = None


class EmployeeJoiningDetailOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    first_day_schedule: Optional[str] = None
    reporting_location: Optional[str] = None
    reporting_time: Optional[str] = None
    reporting_manager_notified: bool
    joining_kit_sent: bool
    instructions_sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Invite ─────────────────────────────────────────────────────────────────────

class InviteAcceptPayload(BaseModel):
    token: str
    new_password: str


# ── Dashboard ──────────────────────────────────────────────────────────────────

class PipelineStageOut(BaseModel):
    status: str
    label: str
    count: int


class OnboardingDashboardOut(BaseModel):
    pipeline: List[PipelineStageOut]
    total_onboarding: int
    bgv_pending: int
    bgv_cleared: int
    bgv_failed: int
    checklist_avg_progress: float
    pending_approvals: int


# ── SLA Configuration ────────────────────────────────────────────────────────

class SLAConfigCreate(BaseModel):
    stage: str
    max_days: int = 7
    escalation_role: str = "admin"
    auto_notify: bool = True


class SLAConfigUpdate(BaseModel):
    max_days: Optional[int] = None
    escalation_role: Optional[str] = None
    auto_notify: Optional[bool] = None
    is_active: Optional[bool] = None


class SLAConfigOut(BaseModel):
    id: UUID4
    stage: str
    max_days: int
    escalation_role: Optional[str] = None
    auto_notify: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SLABreachOut(BaseModel):
    id: UUID4
    employee_id: UUID4
    stage: str
    sla_days: int
    actual_days: int
    breached_at: datetime
    resolved_at: Optional[datetime] = None
    escalated_to: Optional[UUID4] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Bulk Operations ──────────────────────────────────────────────────────────

class BulkTransitionPayload(BaseModel):
    employee_ids: List[str]
    new_status: str
    notes: Optional[str] = None
