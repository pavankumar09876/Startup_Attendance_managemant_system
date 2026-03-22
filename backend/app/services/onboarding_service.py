"""Business logic for the enterprise onboarding module."""

import secrets
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func as sa_func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.user import User, EmployeeStatus, PendingEmployeeRequest, PendingEmployeeRequestStatus
from app.models.onboarding import (
    BackgroundVerification, BGVItem, BGVStatus, BGVItemStatus,
    OnboardingChecklistTemplate, ChecklistTemplateItem, EmployeeChecklistItem,
    EmployeeApprovalStep, ApprovalStepStatus,
    DocumentRequirement, OnboardingStatusTransition,
    JoiningInstruction, EmployeeJoiningDetail,
    OnboardingSLAConfig, SLABreach,
)
from app.models.document import Document


# ── Valid status transitions ───────────────────────────────────────────────────

ALLOWED_TRANSITIONS: Dict[str, List[str]] = {
    "offer_sent":      ["offer_accepted", "terminated"],
    "offer_accepted":  ["pre_onboarding", "terminated"],
    "pre_onboarding":  ["joined", "terminated"],
    "joined":          ["active", "training", "terminated"],
    "invited":         ["active", "terminated"],
    "active":          ["training", "bench", "suspended", "terminated"],
    "training":        ["active", "bench", "suspended", "terminated"],
    "bench":           ["active", "training", "suspended", "terminated"],
    "suspended":       ["active", "terminated"],
}

PIPELINE_STATUSES = [
    ("offer_sent",      "Offer Sent"),
    ("offer_accepted",  "Offer Accepted"),
    ("pre_onboarding",  "Pre-Onboarding"),
    ("joined",          "Joined"),
    ("active",          "Active"),
    ("training",        "Training"),
    ("bench",           "Bench"),
]


# ── Status Transition Service ──────────────────────────────────────────────────

async def transition_employee_status(
    db: AsyncSession,
    employee_id: UUID,
    new_status: str,
    transitioned_by: UUID,
    notes: Optional[str] = None,
) -> OnboardingStatusTransition:
    """Transition an employee to a new status with validation and audit."""
    employee = await db.get(User, employee_id)
    if not employee:
        raise HTTPException(404, "Employee not found")

    current = employee.status.value if employee.status else "invited"
    allowed = ALLOWED_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        raise HTTPException(
            400,
            f"Cannot transition from '{current}' to '{new_status}'. "
            f"Allowed: {allowed}",
        )

    # Gate checks before ACTIVE
    if new_status == "active":
        await _check_activation_gates(db, employee_id)

    # Update employee status + relevant timestamps
    employee.status = EmployeeStatus(new_status)
    now = datetime.now(timezone.utc)
    if new_status == "offer_sent":
        employee.offer_sent_at = now
    elif new_status == "offer_accepted":
        employee.offer_accepted_at = now
    elif new_status == "joined":
        employee.joined_at = now
        employee.is_active = True
    elif new_status == "active":
        employee.is_active = True
    elif new_status == "suspended":
        employee.is_active = False
        employee.suspended_at = now
        employee.suspension_reason = notes
    elif new_status == "terminated":
        employee.is_active = False
        employee.termination_date = now.date()
        employee.termination_reason = notes

    # Log transition
    transition = OnboardingStatusTransition(
        employee_id=employee_id,
        from_status=current,
        to_status=new_status,
        transitioned_by=transitioned_by,
        notes=notes,
    )
    db.add(transition)
    await db.flush()
    return transition


async def get_status_transitions(
    db: AsyncSession, employee_id: UUID
) -> List[OnboardingStatusTransition]:
    result = await db.execute(
        select(OnboardingStatusTransition)
        .where(OnboardingStatusTransition.employee_id == employee_id)
        .order_by(OnboardingStatusTransition.created_at)
    )
    return list(result.scalars().all())


async def _check_activation_gates(db: AsyncSession, employee_id: UUID):
    """Ensure BGV cleared, required docs submitted, required checklist done."""
    from app.models.settings import CompanySettings

    # Load company settings to check if BGV is required
    settings_result = await db.execute(select(CompanySettings).limit(1))
    company = settings_result.scalars().first()
    bgv_required = company.bgv_required if company else False

    # BGV gate
    bgv_result = await db.execute(
        select(BackgroundVerification).where(
            BackgroundVerification.employee_id == employee_id
        )
    )
    bgv = bgv_result.scalars().first()
    if bgv and bgv.status != BGVStatus.CLEARED:
        raise HTTPException(400, "Background verification has not been cleared yet")
    if not bgv and bgv_required:
        raise HTTPException(400, "Background verification is required but has not been initiated")

    # Required checklist items gate
    pending = await db.execute(
        select(sa_func.count()).select_from(EmployeeChecklistItem).where(
            and_(
                EmployeeChecklistItem.employee_id == employee_id,
                EmployeeChecklistItem.is_required == True,
                EmployeeChecklistItem.is_completed == False,
            )
        )
    )
    pending_count = pending.scalar()
    if pending_count and pending_count > 0:
        raise HTTPException(400, f"{pending_count} required checklist item(s) are not completed")

    # Required documents gate
    employee = await db.get(User, employee_id)
    if employee:
        reqs = await _get_matching_requirements(db, employee)
        mandatory = [r for r in reqs if r.is_mandatory]
        if mandatory:
            doc_result = await db.execute(
                select(Document.requirement_id).where(
                    and_(
                        Document.employee_id == employee_id,
                        Document.requirement_id.in_([r.id for r in mandatory]),
                    )
                )
            )
            submitted_ids = {row[0] for row in doc_result.all()}
            missing = [r for r in mandatory if r.id not in submitted_ids]
            if missing:
                names = ", ".join(r.name for r in missing)
                raise HTTPException(400, f"Required documents not submitted: {names}")


# ── BGV Service ────────────────────────────────────────────────────────────────

async def initiate_bgv(
    db: AsyncSession,
    employee_id: UUID,
    initiated_by: UUID,
    vendor_name: Optional[str] = None,
    notes: Optional[str] = None,
    items: Optional[List[Dict]] = None,
) -> BackgroundVerification:
    """Create a BGV record with verification items."""
    # Check if BGV already exists
    existing = await db.execute(
        select(BackgroundVerification).where(
            BackgroundVerification.employee_id == employee_id
        )
    )
    if existing.scalars().first():
        raise HTTPException(400, "BGV already initiated for this employee")

    now = datetime.now(timezone.utc)
    bgv = BackgroundVerification(
        employee_id=employee_id,
        status=BGVStatus.PENDING,
        vendor_name=vendor_name,
        initiated_by=initiated_by,
        initiated_at=now,
        notes=notes,
    )
    db.add(bgv)
    await db.flush()

    # Create items (default to all types if none specified)
    from app.models.onboarding import BGVItemType
    item_types = items or [{"item_type": t} for t in BGVItemType.ALL]
    for item_data in item_types:
        item = BGVItem(
            bgv_id=bgv.id,
            item_type=item_data.get("item_type") if isinstance(item_data, dict) else item_data.item_type,
            notes=item_data.get("notes") if isinstance(item_data, dict) else getattr(item_data, 'notes', None),
        )
        db.add(item)

    await db.flush()
    return bgv


async def get_bgv(db: AsyncSession, employee_id: UUID) -> Optional[BackgroundVerification]:
    result = await db.execute(
        select(BackgroundVerification)
        .options(selectinload(BackgroundVerification.items))
        .where(BackgroundVerification.employee_id == employee_id)
    )
    return result.scalars().first()


async def update_bgv_item(
    db: AsyncSession,
    item_id: UUID,
    status: BGVItemStatus,
    result: Optional[str] = None,
    verified_by: Optional[str] = None,
    notes: Optional[str] = None,
) -> BGVItem:
    """Update a BGV item and auto-calculate overall BGV status."""
    item = await db.get(BGVItem, item_id)
    if not item:
        raise HTTPException(404, "BGV item not found")

    item.status = status
    item.result = result
    item.verified_by = verified_by
    item.notes = notes
    if status in (BGVItemStatus.VERIFIED, BGVItemStatus.FAILED):
        item.verified_at = datetime.now(timezone.utc)

    # Re-calculate parent BGV status
    bgv = await db.get(BackgroundVerification, item.bgv_id)
    all_items_result = await db.execute(
        select(BGVItem).where(BGVItem.bgv_id == item.bgv_id)
    )
    all_items = list(all_items_result.scalars().all())

    # Exclude not_applicable items
    applicable = [i for i in all_items if i.status != BGVItemStatus.NOT_APPLICABLE]
    if not applicable:
        bgv.status = BGVStatus.CLEARED
    elif any(i.status == BGVItemStatus.FAILED for i in applicable):
        bgv.status = BGVStatus.FAILED
        bgv.overall_result = "discrepancy_found"
        bgv.completed_at = datetime.now(timezone.utc)
    elif all(i.status == BGVItemStatus.VERIFIED for i in applicable):
        bgv.status = BGVStatus.CLEARED
        bgv.overall_result = "all_clear"
        bgv.completed_at = datetime.now(timezone.utc)
    else:
        bgv.status = BGVStatus.IN_VERIFICATION

    await db.flush()
    return item


# ── Checklist Service ──────────────────────────────────────────────────────────

async def create_checklist_template(
    db: AsyncSession, data: Dict[str, Any], created_by: UUID
) -> OnboardingChecklistTemplate:
    template = OnboardingChecklistTemplate(
        name=data["name"],
        description=data.get("description"),
        target_role=data.get("target_role"),
        target_department_id=data.get("target_department_id"),
        created_by=created_by,
    )
    db.add(template)
    await db.flush()

    for idx, item_data in enumerate(data.get("items", [])):
        item = ChecklistTemplateItem(
            template_id=template.id,
            title=item_data["title"],
            description=item_data.get("description"),
            category=item_data.get("category", "general"),
            assignee_role=item_data.get("assignee_role", "hr"),
            sort_order=item_data.get("sort_order", idx),
            is_required=item_data.get("is_required", True),
        )
        db.add(item)

    await db.flush()
    return template


async def get_checklist_templates(
    db: AsyncSession,
    role: Optional[str] = None,
    department_id: Optional[UUID] = None,
) -> List[OnboardingChecklistTemplate]:
    query = select(OnboardingChecklistTemplate).options(
        selectinload(OnboardingChecklistTemplate.items)
    )
    if role:
        query = query.where(
            (OnboardingChecklistTemplate.target_role == role) |
            (OnboardingChecklistTemplate.target_role == None)
        )
    if department_id:
        query = query.where(
            (OnboardingChecklistTemplate.target_department_id == department_id) |
            (OnboardingChecklistTemplate.target_department_id == None)
        )
    query = query.where(OnboardingChecklistTemplate.is_active == True)
    result = await db.execute(query)
    return list(result.scalars().all())


async def assign_checklist_to_employee(
    db: AsyncSession, employee_id: UUID, template_id: UUID
) -> List[EmployeeChecklistItem]:
    """Instantiate checklist items for an employee from a template."""
    template = await db.get(OnboardingChecklistTemplate, template_id)
    if not template:
        raise HTTPException(404, "Checklist template not found")

    items_result = await db.execute(
        select(ChecklistTemplateItem)
        .where(ChecklistTemplateItem.template_id == template_id)
        .order_by(ChecklistTemplateItem.sort_order)
    )
    template_items = list(items_result.scalars().all())

    created_items = []
    for ti in template_items:
        item = EmployeeChecklistItem(
            employee_id=employee_id,
            template_item_id=ti.id,
            title=ti.title,
            description=ti.description,
            category=ti.category,
            assignee_role=ti.assignee_role,
            sort_order=ti.sort_order,
            is_required=ti.is_required,
        )
        db.add(item)
        created_items.append(item)

    await db.flush()
    return created_items


async def get_employee_checklist(
    db: AsyncSession, employee_id: UUID
) -> Dict[str, Any]:
    result = await db.execute(
        select(EmployeeChecklistItem)
        .where(EmployeeChecklistItem.employee_id == employee_id)
        .order_by(EmployeeChecklistItem.sort_order)
    )
    items = list(result.scalars().all())

    total = len(items)
    completed = sum(1 for i in items if i.is_completed)
    required_total = sum(1 for i in items if i.is_required)
    required_completed = sum(1 for i in items if i.is_required and i.is_completed)

    return {
        "items": items,
        "progress": {
            "total": total,
            "completed": completed,
            "required_total": required_total,
            "required_completed": required_completed,
            "percentage": round((completed / total * 100) if total > 0 else 0, 1),
        },
    }


async def update_checklist_item(
    db: AsyncSession,
    item_id: UUID,
    is_completed: Optional[bool] = None,
    notes: Optional[str] = None,
    completed_by: Optional[UUID] = None,
) -> EmployeeChecklistItem:
    item = await db.get(EmployeeChecklistItem, item_id)
    if not item:
        raise HTTPException(404, "Checklist item not found")

    if is_completed is not None:
        item.is_completed = is_completed
        if is_completed:
            item.completed_by = completed_by
            item.completed_at = datetime.now(timezone.utc)
        else:
            item.completed_by = None
            item.completed_at = None
    if notes is not None:
        item.notes = notes

    await db.flush()
    return item


# ── Invite Service ─────────────────────────────────────────────────────────────

async def generate_invite(
    db: AsyncSession, employee_id: UUID, created_by: UUID
) -> str:
    """Generate a secure invite token for an employee."""
    employee = await db.get(User, employee_id)
    if not employee:
        raise HTTPException(404, "Employee not found")

    token = secrets.token_urlsafe(48)
    employee.invite_token = token
    employee.invite_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=72)
    await db.flush()
    return token


async def accept_invite(
    db: AsyncSession, token: str, new_password: str
) -> User:
    """Validate invite token and set password."""
    result = await db.execute(
        select(User).where(User.invite_token == token)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(400, "Invalid or expired invite token")

    if user.invite_token_expires_at and user.invite_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, "Invite token has expired. Please contact HR to resend.")

    from app.utils.security import hash_password
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    user.invite_token = None
    user.invite_token_expires_at = None
    user.invite_accepted_at = datetime.now(timezone.utc)

    # Transition to JOINED if in PRE_ONBOARDING, or ACTIVE if INVITED
    if user.status == EmployeeStatus.PRE_ONBOARDING:
        user.status = EmployeeStatus.JOINED
        user.joined_at = datetime.now(timezone.utc)
    elif user.status in (EmployeeStatus.INVITED, EmployeeStatus.OFFER_ACCEPTED):
        user.status = EmployeeStatus.ACTIVE
        user.is_active = True

    await db.flush()
    return user


# ── Multi-Step Approval Service ────────────────────────────────────────────────

async def create_request_with_chain(
    db: AsyncSession,
    payload: Dict,
    requested_by: UUID,
    chain_config: List[Dict],
) -> PendingEmployeeRequest:
    """Create a pending employee request with a multi-step approval chain."""
    request = PendingEmployeeRequest(
        payload=json.dumps(payload, default=str),
        requested_by=requested_by,
        current_approval_level=0,
        max_approval_level=len(chain_config),
        approval_chain_config=json.dumps(chain_config),
    )
    db.add(request)
    await db.flush()

    for step_data in chain_config:
        step = EmployeeApprovalStep(
            request_id=request.id,
            level=step_data["level"],
            approver_role=step_data["role"],
            approver_id=step_data.get("approver_id"),
        )
        db.add(step)

    await db.flush()
    return request


async def approve_step(
    db: AsyncSession,
    request_id: UUID,
    approver: User,
    comment: Optional[str] = None,
) -> PendingEmployeeRequest:
    """Approve the current step in the chain."""
    request = await db.get(PendingEmployeeRequest, request_id)
    if not request or request.status != PendingEmployeeRequestStatus.PENDING:
        raise HTTPException(400, "Request not found or not pending")

    next_level = request.current_approval_level + 1

    # Find the step for this level
    step_result = await db.execute(
        select(EmployeeApprovalStep).where(
            and_(
                EmployeeApprovalStep.request_id == request_id,
                EmployeeApprovalStep.level == next_level,
            )
        )
    )
    step = step_result.scalars().first()

    if not step:
        raise HTTPException(400, "No approval step found for this level")

    # Verify approver has the right role
    if step.approver_id and step.approver_id != approver.id:
        raise HTTPException(403, "You are not the designated approver for this step")

    if step.approver_role and approver.role.value != step.approver_role:
        # Also allow admin/super_admin to approve any step
        if approver.role.value not in ("admin", "super_admin"):
            raise HTTPException(403, f"This step requires a '{step.approver_role}' to approve")

    step.status = ApprovalStepStatus.APPROVED
    step.approver_id = approver.id
    step.comment = comment
    step.acted_at = datetime.now(timezone.utc)
    request.current_approval_level = next_level

    # Check if all steps are done
    if next_level >= request.max_approval_level:
        request.status = PendingEmployeeRequestStatus.APPROVED
        request.reviewed_by = approver.id
        request.reviewed_at = datetime.now(timezone.utc)

    await db.flush()
    return request


async def reject_step(
    db: AsyncSession,
    request_id: UUID,
    approver: User,
    reason: str,
) -> PendingEmployeeRequest:
    """Reject the request at the current step."""
    request = await db.get(PendingEmployeeRequest, request_id)
    if not request or request.status != PendingEmployeeRequestStatus.PENDING:
        raise HTTPException(400, "Request not found or not pending")

    next_level = request.current_approval_level + 1
    step_result = await db.execute(
        select(EmployeeApprovalStep).where(
            and_(
                EmployeeApprovalStep.request_id == request_id,
                EmployeeApprovalStep.level == next_level,
            )
        )
    )
    step = step_result.scalars().first()

    if step:
        step.status = ApprovalStepStatus.REJECTED
        step.approver_id = approver.id
        step.comment = reason
        step.acted_at = datetime.now(timezone.utc)

    request.status = PendingEmployeeRequestStatus.REJECTED
    request.reviewed_by = approver.id
    request.reviewed_at = datetime.now(timezone.utc)
    request.rejection_reason = reason

    await db.flush()
    return request


async def get_request_with_steps(
    db: AsyncSession, request_id: UUID
) -> Optional[PendingEmployeeRequest]:
    result = await db.execute(
        select(PendingEmployeeRequest)
        .options(selectinload(PendingEmployeeRequest.approval_steps))
        .where(PendingEmployeeRequest.id == request_id)
    )
    return result.scalars().first()


# ── Document Requirements Service ──────────────────────────────────────────────

async def create_document_requirement(
    db: AsyncSession, data: Dict[str, Any]
) -> DocumentRequirement:
    req = DocumentRequirement(
        document_type=data["document_type"],
        name=data["name"],
        description=data.get("description"),
        target_role=data.get("target_role"),
        target_department_id=data.get("target_department_id"),
        is_mandatory=data.get("is_mandatory", True),
        has_expiry=data.get("has_expiry", False),
    )
    db.add(req)
    await db.flush()
    return req


async def get_document_requirements(
    db: AsyncSession,
) -> List[DocumentRequirement]:
    result = await db.execute(
        select(DocumentRequirement).order_by(DocumentRequirement.created_at)
    )
    return list(result.scalars().all())


async def _get_matching_requirements(
    db: AsyncSession, employee: User
) -> List[DocumentRequirement]:
    """Get requirements matching an employee's role and department."""
    result = await db.execute(
        select(DocumentRequirement).where(
            (
                (DocumentRequirement.target_role == employee.role.value) |
                (DocumentRequirement.target_role == None)
            ) & (
                (DocumentRequirement.target_department_id == employee.department_id) |
                (DocumentRequirement.target_department_id == None)
            )
        )
    )
    return list(result.scalars().all())


async def get_employee_required_documents(
    db: AsyncSession, employee_id: UUID
) -> List[Dict[str, Any]]:
    """Get required documents for an employee with submission status."""
    employee = await db.get(User, employee_id)
    if not employee:
        raise HTTPException(404, "Employee not found")

    requirements = await _get_matching_requirements(db, employee)

    # Get submitted documents for this employee
    docs_result = await db.execute(
        select(Document).where(Document.employee_id == employee_id)
    )
    docs = list(docs_result.scalars().all())
    submitted_by_req = {d.requirement_id: d for d in docs if d.requirement_id}
    submitted_by_type = {}
    for d in docs:
        submitted_by_type.setdefault(d.document_type, []).append(d)

    result = []
    for req in requirements:
        doc = submitted_by_req.get(req.id)
        if not doc:
            # Fall back to matching by document_type
            type_matches = submitted_by_type.get(req.document_type, [])
            doc = type_matches[0] if type_matches else None

        result.append({
            "requirement": req,
            "submitted": doc is not None,
            "document_id": doc.id if doc else None,
            "verified": doc.verified if doc else False,
        })

    return result


# ── Joining Instructions Service ───────────────────────────────────────────────

async def create_joining_instruction(
    db: AsyncSession, data: Dict[str, Any]
) -> JoiningInstruction:
    ji = JoiningInstruction(
        name=data["name"],
        subject=data["subject"],
        body_html=data["body_html"],
        target_role=data.get("target_role"),
        target_department_id=data.get("target_department_id"),
    )
    db.add(ji)
    await db.flush()
    return ji


async def get_joining_instructions(
    db: AsyncSession,
) -> List[JoiningInstruction]:
    result = await db.execute(
        select(JoiningInstruction)
        .where(JoiningInstruction.is_active == True)
        .order_by(JoiningInstruction.created_at)
    )
    return list(result.scalars().all())


async def create_or_update_joining_detail(
    db: AsyncSession, employee_id: UUID, data: Dict[str, Any]
) -> EmployeeJoiningDetail:
    result = await db.execute(
        select(EmployeeJoiningDetail).where(
            EmployeeJoiningDetail.employee_id == employee_id
        )
    )
    detail = result.scalars().first()

    if detail:
        for key, value in data.items():
            if hasattr(detail, key) and value is not None:
                setattr(detail, key, value)
    else:
        detail = EmployeeJoiningDetail(employee_id=employee_id, **data)
        db.add(detail)

    await db.flush()
    return detail


async def get_joining_detail(
    db: AsyncSession, employee_id: UUID
) -> Optional[EmployeeJoiningDetail]:
    result = await db.execute(
        select(EmployeeJoiningDetail).where(
            EmployeeJoiningDetail.employee_id == employee_id
        )
    )
    return result.scalars().first()


# ── Dashboard / Pipeline Service ───────────────────────────────────────────────

async def get_onboarding_dashboard(db: AsyncSession) -> Dict[str, Any]:
    """Aggregate onboarding statistics."""
    # Pipeline counts
    pipeline = []
    for status_val, label in PIPELINE_STATUSES:
        count_result = await db.execute(
            select(sa_func.count()).select_from(User).where(
                User.status == EmployeeStatus(status_val)
            )
        )
        count = count_result.scalar() or 0
        pipeline.append({"status": status_val, "label": label, "count": count})

    # Total in onboarding (non-active, non-terminated, non-suspended)
    onboarding_statuses = [
        EmployeeStatus.OFFER_SENT,
        EmployeeStatus.OFFER_ACCEPTED,
        EmployeeStatus.PRE_ONBOARDING,
        EmployeeStatus.JOINED,
        EmployeeStatus.INVITED,
    ]
    total_result = await db.execute(
        select(sa_func.count()).select_from(User).where(
            User.status.in_(onboarding_statuses)
        )
    )
    total_onboarding = total_result.scalar() or 0

    # BGV counts
    bgv_counts = {}
    for s in [BGVStatus.PENDING, BGVStatus.CLEARED, BGVStatus.FAILED]:
        r = await db.execute(
            select(sa_func.count()).select_from(BackgroundVerification).where(
                BackgroundVerification.status == s
            )
        )
        bgv_counts[s.value] = r.scalar() or 0

    # Checklist average progress
    checklist_result = await db.execute(
        select(
            EmployeeChecklistItem.employee_id,
            sa_func.count().label("total"),
            sa_func.count().filter(EmployeeChecklistItem.is_completed == True).label("completed"),
        )
        .group_by(EmployeeChecklistItem.employee_id)
    )
    rows = checklist_result.all()
    if rows:
        avg_pct = sum(
            (r.completed / r.total * 100) if r.total > 0 else 0 for r in rows
        ) / len(rows)
    else:
        avg_pct = 0

    # Pending approvals
    pending_result = await db.execute(
        select(sa_func.count()).select_from(PendingEmployeeRequest).where(
            PendingEmployeeRequest.status == PendingEmployeeRequestStatus.PENDING
        )
    )
    pending_approvals = pending_result.scalar() or 0

    return {
        "pipeline": pipeline,
        "total_onboarding": total_onboarding,
        "bgv_pending": bgv_counts.get("pending", 0),
        "bgv_cleared": bgv_counts.get("cleared", 0),
        "bgv_failed": bgv_counts.get("failed", 0),
        "checklist_avg_progress": round(avg_pct, 1),
        "pending_approvals": pending_approvals,
    }


async def get_pipeline_employees(
    db: AsyncSession, status: Optional[str] = None
) -> List[User]:
    """Get employees in the onboarding pipeline, optionally filtered by status."""
    query = select(User)
    if status:
        query = query.where(User.status == EmployeeStatus(status))
    else:
        onboarding_statuses = [
            EmployeeStatus.OFFER_SENT,
            EmployeeStatus.OFFER_ACCEPTED,
            EmployeeStatus.PRE_ONBOARDING,
            EmployeeStatus.JOINED,
            EmployeeStatus.INVITED,
            EmployeeStatus.TRAINING,
            EmployeeStatus.BENCH,
        ]
        query = query.where(User.status.in_(onboarding_statuses))

    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


# ── SLA Configuration Service ────────────────────────────────────────────────

async def get_sla_configs(db: AsyncSession) -> List[OnboardingSLAConfig]:
    result = await db.execute(
        select(OnboardingSLAConfig).order_by(OnboardingSLAConfig.stage)
    )
    return list(result.scalars().all())


async def create_sla_config(
    db: AsyncSession, data: Dict[str, Any]
) -> OnboardingSLAConfig:
    existing = await db.execute(
        select(OnboardingSLAConfig).where(OnboardingSLAConfig.stage == data["stage"])
    )
    if existing.scalars().first():
        raise HTTPException(400, f"SLA config for stage '{data['stage']}' already exists")

    config = OnboardingSLAConfig(
        stage=data["stage"],
        max_days=data.get("max_days", 7),
        escalation_role=data.get("escalation_role", "admin"),
        auto_notify=data.get("auto_notify", True),
    )
    db.add(config)
    await db.flush()
    return config


async def update_sla_config(
    db: AsyncSession, config_id: UUID, data: Dict[str, Any]
) -> OnboardingSLAConfig:
    config = await db.get(OnboardingSLAConfig, config_id)
    if not config:
        raise HTTPException(404, "SLA config not found")

    for key, value in data.items():
        if value is not None and hasattr(config, key):
            setattr(config, key, value)

    await db.flush()
    return config


async def delete_sla_config(db: AsyncSession, config_id: UUID):
    config = await db.get(OnboardingSLAConfig, config_id)
    if not config:
        raise HTTPException(404, "SLA config not found")
    await db.delete(config)
    await db.flush()


async def get_sla_breaches(
    db: AsyncSession,
    stage: Optional[str] = None,
    resolved: Optional[bool] = None,
) -> List[SLABreach]:
    query = select(SLABreach).order_by(SLABreach.breached_at.desc())
    if stage:
        query = query.where(SLABreach.stage == stage)
    if resolved is True:
        query = query.where(SLABreach.resolved_at != None)
    elif resolved is False:
        query = query.where(SLABreach.resolved_at == None)
    result = await db.execute(query)
    return list(result.scalars().all())


async def resolve_sla_breach(
    db: AsyncSession, breach_id: UUID, notes: Optional[str] = None
) -> SLABreach:
    breach = await db.get(SLABreach, breach_id)
    if not breach:
        raise HTTPException(404, "SLA breach not found")
    breach.resolved_at = datetime.now(timezone.utc)
    if notes:
        breach.notes = notes
    await db.flush()
    return breach


async def check_sla_breaches(db: AsyncSession) -> int:
    """Check all employees in onboarding stages against SLA configs.
    Creates breach records for violations. Returns count of new breaches."""
    configs_result = await db.execute(
        select(OnboardingSLAConfig).where(OnboardingSLAConfig.is_active == True)
    )
    configs = {c.stage: c for c in configs_result.scalars().all()}

    if not configs:
        return 0

    now = datetime.now(timezone.utc)
    onboarding_statuses = [
        EmployeeStatus.OFFER_SENT, EmployeeStatus.OFFER_ACCEPTED,
        EmployeeStatus.PRE_ONBOARDING, EmployeeStatus.JOINED,
        EmployeeStatus.TRAINING, EmployeeStatus.BENCH,
    ]

    employees_result = await db.execute(
        select(User).where(
            User.status.in_(onboarding_statuses),
            User.is_active == True,
        )
    )
    employees = employees_result.scalars().all()

    new_breaches = 0
    for emp in employees:
        stage = emp.status.value
        sla = configs.get(stage)
        if not sla:
            continue

        # Determine how long employee has been in this stage
        # Use the latest transition record or created_at as fallback
        last_transition = await db.execute(
            select(OnboardingStatusTransition)
            .where(
                OnboardingStatusTransition.employee_id == emp.id,
                OnboardingStatusTransition.to_status == stage,
            )
            .order_by(OnboardingStatusTransition.created_at.desc())
            .limit(1)
        )
        transition = last_transition.scalars().first()
        entered_at = transition.created_at if transition else emp.created_at
        if entered_at.tzinfo is None:
            entered_at = entered_at.replace(tzinfo=timezone.utc)

        days_in_stage = (now - entered_at).days

        if days_in_stage <= sla.max_days:
            continue

        # Check if breach already recorded for this employee+stage (unresolved)
        existing_breach = await db.execute(
            select(SLABreach).where(
                and_(
                    SLABreach.employee_id == emp.id,
                    SLABreach.stage == stage,
                    SLABreach.resolved_at == None,
                )
            )
        )
        if existing_breach.scalars().first():
            continue  # Already tracked

        breach = SLABreach(
            employee_id=emp.id,
            stage=stage,
            sla_days=sla.max_days,
            actual_days=days_in_stage,
        )
        db.add(breach)
        new_breaches += 1

    if new_breaches:
        await db.flush()

    return new_breaches


# ── Bulk Operations ──────────────────────────────────────────────────────────

async def bulk_transition_employees(
    db: AsyncSession,
    employee_ids: List[str],
    new_status: str,
    transitioned_by: UUID,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Transition multiple employees to a new status. Returns success/failure counts."""
    succeeded = 0
    failed = []

    for eid_str in employee_ids:
        try:
            eid = UUID(eid_str)
            await transition_employee_status(db, eid, new_status, transitioned_by, notes)
            succeeded += 1
        except Exception as e:
            failed.append({"employee_id": eid_str, "error": str(e)})

    if succeeded:
        await db.flush()

    return {"succeeded": succeeded, "failed": failed, "total": len(employee_ids)}
