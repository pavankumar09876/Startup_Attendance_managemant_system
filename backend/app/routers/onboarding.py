"""Enterprise onboarding router — BGV, checklists, status transitions,
multi-step approvals, document requirements, joining instructions, dashboard."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.utils.dependencies import get_current_user, require_permission
from app.services import onboarding_service as svc
from app.schemas.onboarding import (
    # Status transitions
    TransitionStatusPayload, OnboardingStatusTransitionOut,
    # BGV
    BGVCreate, BGVOut, BGVItemUpdate, BGVItemOut,
    # Checklists
    ChecklistTemplateCreate, ChecklistTemplateUpdate, ChecklistTemplateOut,
    EmployeeChecklistOut, EmployeeChecklistItemUpdate, EmployeeChecklistItemOut,
    # Approvals
    ApprovalChainStep, ApproveStepPayload, RejectStepPayload, EmployeeApprovalStepOut,
    # Document requirements
    DocumentRequirementCreate, DocumentRequirementOut, RequiredDocumentStatusOut,
    # Joining
    JoiningInstructionCreate, JoiningInstructionOut,
    EmployeeJoiningDetailCreate, EmployeeJoiningDetailOut,
    # Invite
    InviteAcceptPayload,
    # Dashboard
    OnboardingDashboardOut, PipelineStageOut,
    # SLA
    SLAConfigCreate, SLAConfigUpdate, SLAConfigOut, SLABreachOut,
    # Bulk
    BulkTransitionPayload,
)
from app.schemas.user import UserOut

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


# ── Status Transitions ─────────────────────────────────────────────────────────

@router.post("/employees/{employee_id}/transition", response_model=OnboardingStatusTransitionOut)
async def transition_status(
    employee_id: UUID,
    payload: TransitionStatusPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    transition = await svc.transition_employee_status(
        db, employee_id, payload.new_status, current_user.id, payload.notes,
    )
    await db.commit()
    return transition


@router.get("/employees/{employee_id}/transitions", response_model=List[OnboardingStatusTransitionOut])
async def get_transitions(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    return await svc.get_status_transitions(db, employee_id)


# ── BGV ────────────────────────────────────────────────────────────────────────

@router.post("/employees/{employee_id}/bgv", response_model=BGVOut)
async def initiate_bgv(
    employee_id: UUID,
    payload: BGVCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    bgv = await svc.initiate_bgv(
        db, employee_id, current_user.id,
        vendor_name=payload.vendor_name,
        notes=payload.notes,
        items=[item.model_dump() for item in payload.items] if payload.items else None,
    )
    await db.commit()
    # Re-fetch with items loaded
    return await svc.get_bgv(db, employee_id)


@router.get("/employees/{employee_id}/bgv", response_model=Optional[BGVOut])
async def get_bgv(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    return await svc.get_bgv(db, employee_id)


@router.patch("/bgv-items/{item_id}", response_model=BGVItemOut)
async def update_bgv_item(
    item_id: UUID,
    payload: BGVItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    item = await svc.update_bgv_item(
        db, item_id, payload.status,
        result=payload.result, verified_by=payload.verified_by, notes=payload.notes,
    )
    await db.commit()
    return item


# ── Checklist Templates ────────────────────────────────────────────────────────

@router.get("/checklist-templates", response_model=List[ChecklistTemplateOut])
async def list_templates(
    role: Optional[str] = None,
    department_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    return await svc.get_checklist_templates(db, role=role, department_id=department_id)


@router.post("/checklist-templates", response_model=ChecklistTemplateOut)
async def create_template(
    payload: ChecklistTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    template = await svc.create_checklist_template(
        db, payload.model_dump(), current_user.id,
    )
    await db.commit()
    # Re-fetch with items
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.onboarding import OnboardingChecklistTemplate
    result = await db.execute(
        select(OnboardingChecklistTemplate)
        .options(selectinload(OnboardingChecklistTemplate.items))
        .where(OnboardingChecklistTemplate.id == template.id)
    )
    return result.scalars().first()


# ── Per-Employee Checklists ────────────────────────────────────────────────────

@router.post("/employees/{employee_id}/checklist", response_model=List[EmployeeChecklistItemOut])
async def assign_checklist(
    employee_id: UUID,
    template_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    items = await svc.assign_checklist_to_employee(db, employee_id, template_id)
    await db.commit()
    return items


@router.get("/employees/{employee_id}/checklist", response_model=EmployeeChecklistOut)
async def get_employee_checklist(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    return await svc.get_employee_checklist(db, employee_id)


@router.patch("/checklist-items/{item_id}", response_model=EmployeeChecklistItemOut)
async def update_checklist_item(
    item_id: UUID,
    payload: EmployeeChecklistItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Allow self-service for employee-assigned items
    from app.models.onboarding import EmployeeChecklistItem
    item = await db.get(EmployeeChecklistItem, item_id)
    if not item:
        from fastapi import HTTPException
        raise HTTPException(404, "Checklist item not found")

    is_own_item = (
        item.employee_id == current_user.id and item.assignee_role == "employee"
    )
    if not is_own_item:
        # Require onboarding:manage permission
        from app.utils.dependencies import check_permission
        await check_permission(current_user, db, "onboarding:manage")

    updated = await svc.update_checklist_item(
        db, item_id,
        is_completed=payload.is_completed,
        notes=payload.notes,
        completed_by=current_user.id,
    )
    await db.commit()
    return updated


# ── Invite ─────────────────────────────────────────────────────────────────────

@router.post("/employees/{employee_id}/invite")
async def send_invite(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    token = await svc.generate_invite(db, employee_id, current_user.id)
    await db.commit()

    # Send invite email
    employee = await db.get(User, employee_id)
    from app.config import settings
    invite_url = f"{settings.ALLOWED_ORIGINS[0]}/auth/accept-invite?token={token}"

    try:
        from app.utils.email import send_invite_email
        await send_invite_email(
            to=employee.email,
            full_name=f"{employee.first_name} {employee.last_name}",
            invite_url=invite_url,
            expiry_hours=72,
        )
    except Exception:
        pass  # Email sending is best-effort

    return {"message": "Invite sent", "invite_url": invite_url}


# ── Multi-Step Approvals ───────────────────────────────────────────────────────

@router.post("/requests")
async def create_request_with_chain(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:create")),
):
    employee_data = payload.get("employee_data", {})
    chain = payload.get("approval_chain", [{"level": 1, "role": "admin"}])

    request = await svc.create_request_with_chain(
        db, employee_data, current_user.id, chain,
    )
    await db.commit()
    return {"id": str(request.id), "status": request.status.value}


@router.get("/requests")
async def list_requests(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:create")),
):
    from sqlalchemy import select
    from app.models.user import PendingEmployeeRequest, PendingEmployeeRequestStatus
    query = select(PendingEmployeeRequest).order_by(PendingEmployeeRequest.created_at.desc())
    if status:
        query = query.where(PendingEmployeeRequest.status == PendingEmployeeRequestStatus(status))
    result = await db.execute(query)
    requests = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "status": r.status.value,
            "current_approval_level": r.current_approval_level,
            "max_approval_level": r.max_approval_level,
            "requested_by": str(r.requested_by),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in requests
    ]


@router.get("/requests/{request_id}")
async def get_request_detail(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:create")),
):
    req = await svc.get_request_with_steps(db, request_id)
    if not req:
        from fastapi import HTTPException
        raise HTTPException(404, "Request not found")

    import json
    return {
        "id": str(req.id),
        "payload": json.loads(req.payload) if req.payload else {},
        "status": req.status.value,
        "current_approval_level": req.current_approval_level,
        "max_approval_level": req.max_approval_level,
        "requested_by": str(req.requested_by),
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "steps": [
            {
                "id": str(s.id),
                "level": s.level,
                "approver_role": s.approver_role,
                "approver_id": str(s.approver_id) if s.approver_id else None,
                "status": s.status.value,
                "comment": s.comment,
                "acted_at": s.acted_at.isoformat() if s.acted_at else None,
            }
            for s in sorted(req.approval_steps, key=lambda x: x.level)
        ],
    }


@router.post("/requests/{request_id}/approve")
async def approve_request_step(
    request_id: UUID,
    payload: ApproveStepPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:approve")),
):
    request = await svc.approve_step(db, request_id, current_user, payload.comment)
    await db.commit()

    # If fully approved, create the employee
    from app.models.user import PendingEmployeeRequestStatus
    if request.status == PendingEmployeeRequestStatus.APPROVED:
        import json
        payload_data = json.loads(request.payload)
        from app.services.user_service import create_user
        user = await create_user(db, payload_data, current_user)
        await db.commit()
        return {"message": "Request approved and employee created", "employee_id": str(user.id)}

    return {
        "message": f"Step {request.current_approval_level} approved",
        "current_level": request.current_approval_level,
        "max_level": request.max_approval_level,
    }


@router.post("/requests/{request_id}/reject")
async def reject_request_step(
    request_id: UUID,
    payload: RejectStepPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:approve")),
):
    await svc.reject_step(db, request_id, current_user, payload.reason)
    await db.commit()
    return {"message": "Request rejected"}


# ── Document Requirements ─────────────────────────────────────────────────────

@router.get("/document-requirements", response_model=List[DocumentRequirementOut])
async def list_document_requirements(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    return await svc.get_document_requirements(db)


@router.post("/document-requirements", response_model=DocumentRequirementOut)
async def create_document_requirement(
    payload: DocumentRequirementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    req = await svc.create_document_requirement(db, payload.model_dump())
    await db.commit()
    return req


@router.delete("/document-requirements/{req_id}")
async def delete_document_requirement(
    req_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    from app.models.onboarding import DocumentRequirement
    req = await db.get(DocumentRequirement, req_id)
    if not req:
        from fastapi import HTTPException
        raise HTTPException(404, "Requirement not found")
    await db.delete(req)
    await db.commit()
    return {"message": "Deleted"}


@router.get("/employees/{employee_id}/required-documents", response_model=List[RequiredDocumentStatusOut])
async def get_required_documents(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    return await svc.get_employee_required_documents(db, employee_id)


# ── Joining Instructions ──────────────────────────────────────────────────────

@router.get("/joining-templates", response_model=List[JoiningInstructionOut])
async def list_joining_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    return await svc.get_joining_instructions(db)


@router.post("/joining-templates", response_model=JoiningInstructionOut)
async def create_joining_template(
    payload: JoiningInstructionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    ji = await svc.create_joining_instruction(db, payload.model_dump())
    await db.commit()
    return ji


@router.post("/employees/{employee_id}/send-joining-instructions")
async def send_joining_instructions(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    employee = await db.get(User, employee_id)
    if not employee:
        from fastapi import HTTPException
        raise HTTPException(404, "Employee not found")

    # Find matching template
    from sqlalchemy import select
    from app.models.onboarding import JoiningInstruction
    result = await db.execute(
        select(JoiningInstruction).where(
            JoiningInstruction.is_active == True,
            (JoiningInstruction.target_role == employee.role.value) |
            (JoiningInstruction.target_role == None),
        ).limit(1)
    )
    template = result.scalars().first()

    if template:
        try:
            from app.utils.email import send_joining_instructions_email
            manager = await db.get(User, employee.manager_id) if employee.manager_id else None
            await send_joining_instructions_email(
                to=employee.email,
                full_name=f"{employee.first_name} {employee.last_name}",
                subject=template.subject,
                body_html=template.body_html,
                manager_name=f"{manager.first_name} {manager.last_name}" if manager else "TBD",
            )
        except Exception:
            pass

    # Update joining detail
    detail = await svc.get_joining_detail(db, employee_id)
    if detail:
        from datetime import datetime, timezone
        detail.instructions_sent_at = datetime.now(timezone.utc)
    else:
        from datetime import datetime, timezone
        await svc.create_or_update_joining_detail(db, employee_id, {
            "instructions_sent_at": datetime.now(timezone.utc),
        })

    await db.commit()
    return {"message": "Joining instructions sent"}


@router.get("/employees/{employee_id}/joining-details", response_model=Optional[EmployeeJoiningDetailOut])
async def get_joining_details(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    return await svc.get_joining_detail(db, employee_id)


@router.post("/employees/{employee_id}/joining-details", response_model=EmployeeJoiningDetailOut)
async def set_joining_details(
    employee_id: UUID,
    payload: EmployeeJoiningDetailCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    detail = await svc.create_or_update_joining_detail(
        db, employee_id, payload.model_dump(exclude_unset=True),
    )
    await db.commit()
    return detail


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=OnboardingDashboardOut)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    from app.utils.cache import cache_get, cache_set
    cache_key = "dashboard:onboarding"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    data = await svc.get_onboarding_dashboard(db)
    await cache_set(cache_key, data, ttl=300)
    return data


@router.get("/pipeline")
async def get_pipeline(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    employees = await svc.get_pipeline_employees(db, status=status)
    return [
        {
            "id": str(e.id),
            "employee_id": e.employee_id,
            "first_name": e.first_name,
            "last_name": e.last_name,
            "email": e.email,
            "role": e.role.value,
            "status": e.status.value if e.status else "invited",
            "department_id": str(e.department_id) if e.department_id else None,
            "designation": e.designation,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in employees
    ]


# ── SLA Configuration ────────────────────────────────────────────────────────

@router.get("/sla-configs", response_model=List[SLAConfigOut])
async def list_sla_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    return await svc.get_sla_configs(db)


@router.post("/sla-configs", response_model=SLAConfigOut)
async def create_sla_config(
    payload: SLAConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    config = await svc.create_sla_config(db, payload.model_dump())
    await db.commit()
    return config


@router.patch("/sla-configs/{config_id}", response_model=SLAConfigOut)
async def update_sla_config(
    config_id: UUID,
    payload: SLAConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    config = await svc.update_sla_config(db, config_id, payload.model_dump(exclude_unset=True))
    await db.commit()
    return config


@router.delete("/sla-configs/{config_id}")
async def delete_sla_config(
    config_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    await svc.delete_sla_config(db, config_id)
    await db.commit()
    return {"message": "SLA config deleted"}


# ── SLA Breaches ─────────────────────────────────────────────────────────────

@router.get("/sla-breaches", response_model=List[SLABreachOut])
async def list_sla_breaches(
    stage: Optional[str] = None,
    resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:view")),
):
    return await svc.get_sla_breaches(db, stage=stage, resolved=resolved)


@router.post("/sla-breaches/{breach_id}/resolve", response_model=SLABreachOut)
async def resolve_sla_breach(
    breach_id: UUID,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    breach = await svc.resolve_sla_breach(db, breach_id, notes)
    await db.commit()
    return breach


# ── Bulk Operations ──────────────────────────────────────────────────────────

@router.post("/bulk-transition")
async def bulk_transition(
    payload: BulkTransitionPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("onboarding:manage")),
):
    result = await svc.bulk_transition_employees(
        db, payload.employee_ids, payload.new_status,
        current_user.id, payload.notes,
    )
    await db.commit()
    return result
