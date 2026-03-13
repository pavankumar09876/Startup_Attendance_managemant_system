"""Settings router — /api/settings"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Dict
import uuid
import os

from app.database import get_db
from app.models.settings import (
    CompanySettings, AttendanceConfig, LeavePolicy,
    RolePermission, NotificationPreference,
)
from app.models.user import User, Role
from app.schemas.settings import (
    CompanySettingsOut, CompanySettingsUpdate,
    AttendanceConfigOut, AttendanceConfigUpdate,
    LeavePolicyCreate, LeavePolicyUpdate, LeavePolicyOut,
    RolePermissionsOut, RolePermissionsUpdate, ModulePermissions,
    NotificationPrefOut, NotificationPrefUpdate,
)
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/settings", tags=["Settings"])

ADMIN_ROLES = (Role.SUPER_ADMIN, Role.ADMIN, Role.HR)
MODULES = ["attendance", "leave", "projects", "tasks", "staff", "payroll", "reports", "settings"]


# ── Helpers ──────────────────────────────────────────────────────────────────
async def _get_or_create_singleton(db: AsyncSession, Model):
    result = await db.execute(select(Model).limit(1))
    obj = result.scalar_one_or_none()
    if not obj:
        obj = Model()
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
    return obj


# ── Company settings ─────────────────────────────────────────────────────────
@router.get("/company", response_model=CompanySettingsOut)
async def get_company(
    db: AsyncSession = Depends(get_db),
    _:  User = Depends(require_roles(*ADMIN_ROLES)),
):
    return await _get_or_create_singleton(db, CompanySettings)


@router.patch("/company", response_model=CompanySettingsOut)
async def update_company(
    payload: CompanySettingsUpdate,
    db:      AsyncSession = Depends(get_db),
    _:       User = Depends(require_roles(*ADMIN_ROLES)),
):
    obj = await _get_or_create_singleton(db, CompanySettings)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/company/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db:   AsyncSession = Depends(get_db),
    _:    User = Depends(require_roles(*ADMIN_ROLES)),
):
    obj = await _get_or_create_singleton(db, CompanySettings)
    upload_dir = "uploads/logos"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "logo.png")[1]
    path = os.path.join(upload_dir, f"company_logo{ext}")
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    obj.logo_url = f"/uploads/logos/company_logo{ext}"
    await db.commit()
    return {"logo_url": obj.logo_url}


# ── Attendance config ─────────────────────────────────────────────────────────
@router.get("/attendance", response_model=AttendanceConfigOut)
async def get_attendance_config(
    db: AsyncSession = Depends(get_db),
    _:  User = Depends(require_roles(*ADMIN_ROLES)),
):
    return await _get_or_create_singleton(db, AttendanceConfig)


@router.patch("/attendance", response_model=AttendanceConfigOut)
async def update_attendance_config(
    payload: AttendanceConfigUpdate,
    db:      AsyncSession = Depends(get_db),
    _:       User = Depends(require_roles(*ADMIN_ROLES)),
):
    obj = await _get_or_create_singleton(db, AttendanceConfig)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


# ── Leave policies ────────────────────────────────────────────────────────────
@router.get("/leave-types", response_model=list[LeavePolicyOut])
async def list_leave_types(
    db: AsyncSession = Depends(get_db),
    _:  User = Depends(get_current_user),
):
    result = await db.execute(select(LeavePolicy).order_by(LeavePolicy.name))
    return result.scalars().all()


@router.post("/leave-types", response_model=LeavePolicyOut, status_code=201)
async def create_leave_type(
    payload: LeavePolicyCreate,
    db:      AsyncSession = Depends(get_db),
    _:       User = Depends(require_roles(*ADMIN_ROLES)),
):
    obj = LeavePolicy(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/leave-types/{policy_id}", response_model=LeavePolicyOut)
async def update_leave_type(
    policy_id: uuid.UUID,
    payload:   LeavePolicyUpdate,
    db:        AsyncSession = Depends(get_db),
    _:         User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = await db.execute(select(LeavePolicy).where(LeavePolicy.id == policy_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Leave type not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/leave-types/{policy_id}", status_code=204)
async def delete_leave_type(
    policy_id: uuid.UUID,
    db:        AsyncSession = Depends(get_db),
    _:         User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = await db.execute(select(LeavePolicy).where(LeavePolicy.id == policy_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Leave type not found")
    await db.delete(obj)
    await db.commit()


# ── Role permissions ──────────────────────────────────────────────────────────
@router.get("/permissions/{role}", response_model=RolePermissionsOut)
async def get_permissions(
    role: str,
    db:   AsyncSession = Depends(get_db),
    _:    User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    result = await db.execute(
        select(RolePermission).where(RolePermission.role == role)
    )
    rows = result.scalars().all()

    perms: Dict[str, ModulePermissions] = {}
    for module in MODULES:
        row = next((r for r in rows if r.module == module), None)
        perms[module] = ModulePermissions(
            view    = row.can_view    if row else False,
            create  = row.can_create  if row else False,
            edit    = row.can_edit    if row else False,
            delete  = row.can_delete  if row else False,
            approve = row.can_approve if row else False,
        )

    return RolePermissionsOut(role=role, permissions=perms)


@router.put("/permissions/{role}", response_model=RolePermissionsOut)
async def update_permissions(
    role:    str,
    payload: RolePermissionsUpdate,
    db:      AsyncSession = Depends(get_db),
    _:       User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    for module, mp in payload.permissions.items():
        result = await db.execute(
            select(RolePermission).where(
                RolePermission.role   == role,
                RolePermission.module == module,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            row.can_view    = mp.view
            row.can_create  = mp.create
            row.can_edit    = mp.edit
            row.can_delete  = mp.delete
            row.can_approve = mp.approve
        else:
            db.add(RolePermission(
                role=role, module=module,
                can_view=mp.view, can_create=mp.create,
                can_edit=mp.edit, can_delete=mp.delete, can_approve=mp.approve,
            ))
    await db.commit()

    return await get_permissions(role, db, _)


# ── Notification preferences ──────────────────────────────────────────────────
@router.get("/notifications", response_model=NotificationPrefOut)
async def get_notif_prefs(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == str(current_user.id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        obj = NotificationPreference(user_id=str(current_user.id))
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
    return obj


@router.patch("/notifications", response_model=NotificationPrefOut)
async def update_notif_prefs(
    payload:      NotificationPrefUpdate,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == str(current_user.id)
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        obj = NotificationPreference(user_id=str(current_user.id))
        db.add(obj)

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj
