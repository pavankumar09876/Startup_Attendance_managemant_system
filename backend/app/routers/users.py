from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid
import asyncio

from app.database import get_db
from app.models.user import User, Role, PendingEmployeeRequest, PendingEmployeeRequestStatus
from app.schemas.user import (
    UserCreate, UserUpdate, UserOut,
    DepartmentCreate, DepartmentUpdate, DepartmentOut,
)
from app.utils.dependencies import get_current_user, require_permission, verify_reauth
from app.utils.email import send_welcome_email
from app.services.user_service import (
    list_users as svc_list_users,
    create_user as svc_create_user,
    update_user as svc_update_user,
    deactivate_user as svc_deactivate_user,
    suspend_user as svc_suspend_user,
    reactivate_user as svc_reactivate_user,
    list_departments as svc_list_departments,
    create_department as svc_create_department,
    update_department as svc_update_department,
    delete_department as svc_delete_department,
    get_org_chart as svc_get_org_chart,
)
from app.services.exceptions import ServiceError

router = APIRouter(prefix="/users", tags=["Users"])


# ── Departments ──────────────────────────────────────────────────────────────

@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db)):
    try:
        rows = await svc_list_departments(db)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)

    return [
        DepartmentOut(
            id=r["dept"].id,
            name=r["dept"].name,
            description=r["dept"].description,
            type=r["dept"].type,
            head_id=r["dept"].head_id,
            head_name=r["head_name"],
            employee_count=r["employee_count"],
            created_at=r["dept"].created_at,
        )
        for r in rows
    ]


@router.post("/departments", response_model=DepartmentOut, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("department:manage")),
):
    try:
        dept = await svc_create_department(db, payload.model_dump())
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)

    return DepartmentOut(
        id=dept.id,
        name=dept.name,
        description=dept.description,
        type=dept.type,
        head_id=dept.head_id,
        head_name=None,
        employee_count=0,
        created_at=dept.created_at,
    )


@router.patch("/departments/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: uuid.UUID,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("department:manage")),
):
    try:
        result = await svc_update_department(
            db, dept_id, payload.model_dump(exclude_unset=True),
        )
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)

    dept = result["dept"]
    return DepartmentOut(
        id=dept.id, name=dept.name, description=dept.description,
        type=dept.type, head_id=dept.head_id, head_name=result["head_name"],
        employee_count=result["employee_count"], created_at=dept.created_at,
    )


@router.delete("/departments/{dept_id}", status_code=204)
async def delete_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("department:manage")),
):
    try:
        await svc_delete_department(db, dept_id)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/generate-id")
async def generate_employee_id(
    _: User = Depends(get_current_user),
):
    """Auto-generate a unique employee ID (UUID)."""
    return {"employee_id": str(uuid.uuid4())}


@router.get("/")
async def list_users(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[Role] = None,
    department_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:view")),
):
    filters = {
        "search": search,
        "skip": skip,
        "limit": limit,
        "role": role,
        "department_id": department_id,
        "is_active": is_active,
    }
    try:
        return await svc_list_users(db, current_user, filters)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:create")),
):
    try:
        user = await svc_create_user(
            db,
            payload.model_dump(),
            created_by=current_user,
        )
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)

    # The service attaches _temp_password and _send_welcome_email
    # so the router can handle the async email side-effect.
    temp_password = getattr(user, "_temp_password", None)
    send_email = getattr(user, "_send_welcome_email", False)

    if send_email and temp_password:
        full_name = f"{user.first_name} {user.last_name}"
        asyncio.create_task(
            asyncio.to_thread(send_welcome_email, user.email, full_name, temp_password)
        )

    return user


# ── Org chart ─────────────────────────────────────────────────────────────────

@router.get("/org-chart")
async def org_chart(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return flat list of all active users with manager_id for frontend tree building."""
    try:
        return await svc_get_org_chart(db)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.department))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    confirm_password: Optional[str] = Query(None, description="Password for re-auth on salary/role changes"),
    confirm_mfa: Optional[str] = Query(None, description="MFA code for re-auth on salary/role changes"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Self-edit is always allowed (service layer restricts which fields).
    # Editing *another* user requires employee:update permission.
    if str(user_id) != str(current_user.id):
        from app.utils.dependencies import check_permission
        await check_permission(current_user, db, "employee:update")

    data = payload.model_dump(exclude_unset=True)

    # Require re-auth only when sensitive fields actually CHANGE value
    SENSITIVE_REAUTH_FIELDS = {"salary", "hra", "allowances", "role"}
    MONEY_FIELDS = {"salary", "hra", "allowances"}
    sensitive_changed = False
    sensitive_in_payload = {f for f in SENSITIVE_REAUTH_FIELDS if f in data}
    if sensitive_in_payload:
        from sqlalchemy import select as _sel
        target = (await db.execute(
            _sel(User).where(User.id == user_id)
        )).scalar_one_or_none()
        if target:
            for f in sensitive_in_payload:
                old_val = getattr(target, f, None)
                new_val = data[f]
                if f in MONEY_FIELDS:
                    # Treat None/0/0.0 as equivalent (empty field → 0)
                    old_num = float(old_val) if old_val else 0.0
                    new_num = float(new_val) if new_val else 0.0
                    if old_num != new_num:
                        sensitive_changed = True
                        break
                else:
                    # Role: compare enum .value on both sides
                    old_str = old_val.value if hasattr(old_val, 'value') else str(old_val or "")
                    new_str = new_val.value if hasattr(new_val, 'value') else str(new_val or "")
                    if old_str != new_str:
                        sensitive_changed = True
                        break
    if sensitive_changed:
        # Privileged users (super_admin / admin / hr) editing OTHER users
        # already proved identity via permission check — skip re-auth.
        # Re-auth only needed for self-edits or non-privileged users.
        is_privileged_editing_other = (
            str(user_id) != str(current_user.id)
            and current_user.role in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
        )
        if not is_privileged_editing_other:
            await verify_reauth(current_user, password=confirm_password, mfa_code=confirm_mfa)

    try:
        return await svc_update_user(db, user_id, data, current_user)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    confirm_password: Optional[str] = Query(None, description="Password for re-authentication"),
    confirm_mfa: Optional[str] = Query(None, description="MFA code for re-authentication"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:delete")),
):
    """Terminate an employee. Requires re-authentication."""
    await verify_reauth(current_user, password=confirm_password, mfa_code=confirm_mfa)
    try:
        await svc_deactivate_user(db, user_id, performed_by=current_user)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


@router.post("/{user_id}/suspend", response_model=UserOut)
async def suspend_user(
    user_id: uuid.UUID,
    reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:update")),
):
    """Suspend an employee temporarily."""
    try:
        return await svc_suspend_user(db, user_id, performed_by=current_user, reason=reason)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


@router.post("/{user_id}/reactivate", response_model=UserOut)
async def reactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:update")),
):
    """Reactivate a suspended employee."""
    try:
        return await svc_reactivate_user(db, user_id, performed_by=current_user)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)


# ── Maker-Checker: Pending Employee Requests ──────────────────────────────────

@router.post("/requests", status_code=201)
async def create_employee_request(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:create")),
):
    """Submit a pending employee creation request (maker step)."""
    import json
    from sqlalchemy import select as _sel
    # Check duplicate email
    existing = (await db.execute(_sel(User).where(User.email == payload.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Email already registered")

    request_obj = PendingEmployeeRequest(
        payload=json.dumps(payload.model_dump(), default=str),
        requested_by=current_user.id,
    )
    db.add(request_obj)
    from app.utils.audit import log_action
    await log_action(
        db, current_user, "employee.request_created", "PendingEmployeeRequest", None,
        description=f"Submitted employee creation request for {payload.email}",
    )
    await db.commit()
    await db.refresh(request_obj)
    return {
        "id": str(request_obj.id),
        "email": payload.email,
        "status": request_obj.status.value,
        "created_at": request_obj.created_at.isoformat() if request_obj.created_at else None,
    }


@router.get("/requests")
async def list_pending_requests(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:create")),
):
    """List pending employee creation requests."""
    from sqlalchemy import select as _sel
    import json
    q = _sel(PendingEmployeeRequest).order_by(PendingEmployeeRequest.created_at.desc())
    if status:
        q = q.where(PendingEmployeeRequest.status == status)
    result = await db.execute(q)
    requests = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "payload": json.loads(r.payload),
            "status": r.status.value,
            "requested_by": str(r.requested_by),
            "reviewed_by": str(r.reviewed_by) if r.reviewed_by else None,
            "rejection_reason": r.rejection_reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        }
        for r in requests
    ]


@router.post("/requests/{request_id}/approve", response_model=UserOut)
async def approve_employee_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:approve")),
):
    """Approve a pending employee request and create the user (checker step)."""
    import json
    from sqlalchemy import select as _sel
    from datetime import datetime as _dt, timezone as _tz

    req = (await db.execute(
        _sel(PendingEmployeeRequest).where(PendingEmployeeRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != PendingEmployeeRequestStatus.PENDING:
        raise HTTPException(400, "Request already reviewed")

    # Cannot approve your own request
    if req.requested_by == current_user.id:
        raise HTTPException(403, "Cannot approve your own request. Another authorized user must approve.")

    payload_dict = json.loads(req.payload)
    try:
        user = await svc_create_user(db, payload_dict, created_by=current_user)
    except ServiceError as e:
        raise HTTPException(status_code=e.code, detail=e.message)

    req.status = PendingEmployeeRequestStatus.APPROVED
    req.reviewed_by = current_user.id
    req.reviewed_at = _dt.now(_tz.utc)

    from app.utils.audit import log_action
    await log_action(
        db, current_user, "employee.request_approved", "PendingEmployeeRequest", str(request_id),
        description=f"Approved employee creation request for {payload_dict.get('email')}",
    )
    await db.commit()

    # Handle welcome email
    temp_password = getattr(user, "_temp_password", None)
    send_email = getattr(user, "_send_welcome_email", False)
    if send_email and temp_password:
        full_name = f"{user.first_name} {user.last_name}"
        asyncio.create_task(asyncio.to_thread(send_welcome_email, user.email, full_name, temp_password))

    return user


@router.post("/requests/{request_id}/reject")
async def reject_employee_request(
    request_id: uuid.UUID,
    reason: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employee:approve")),
):
    """Reject a pending employee request."""
    from sqlalchemy import select as _sel
    from datetime import datetime as _dt, timezone as _tz

    req = (await db.execute(
        _sel(PendingEmployeeRequest).where(PendingEmployeeRequest.id == request_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != PendingEmployeeRequestStatus.PENDING:
        raise HTTPException(400, "Request already reviewed")

    req.status = PendingEmployeeRequestStatus.REJECTED
    req.reviewed_by = current_user.id
    req.reviewed_at = _dt.now(_tz.utc)
    req.rejection_reason = reason

    from app.utils.audit import log_action
    await log_action(
        db, current_user, "employee.request_rejected", "PendingEmployeeRequest", str(request_id),
        description=f"Rejected employee creation request: {reason}",
    )
    await db.commit()
    return {"message": "Request rejected", "reason": reason}
