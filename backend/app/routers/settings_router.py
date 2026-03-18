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
from app.utils.dependencies import get_current_user, require_roles, require_permission
from app.utils.audit import log_action

router = APIRouter(prefix="/settings", tags=["Settings"])
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
    _:  User = Depends(require_permission("settings:company")),
):
    return await _get_or_create_singleton(db, CompanySettings)


@router.patch("/company", response_model=CompanySettingsOut)
async def update_company(
    payload: CompanySettingsUpdate,
    db:      AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:company")),
):
    obj = await _get_or_create_singleton(db, CompanySettings)
    changed = payload.model_dump(exclude_none=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    await log_action(
        db, current_user, "settings.company_updated", "CompanySettings", None,
        description=f"Updated company settings: {', '.join(changed.keys())}",
    )
    await db.commit()
    await db.refresh(obj)
    return obj


@router.post("/company/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db:   AsyncSession = Depends(get_db),
    _:    User = Depends(require_permission("settings:company")),
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
    _:  User = Depends(require_permission("settings:attendance")),
):
    return await _get_or_create_singleton(db, AttendanceConfig)


@router.patch("/attendance", response_model=AttendanceConfigOut)
async def update_attendance_config(
    payload: AttendanceConfigUpdate,
    db:      AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:attendance")),
):
    obj = await _get_or_create_singleton(db, AttendanceConfig)
    changed = payload.model_dump(exclude_none=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    await log_action(
        db, current_user, "settings.attendance_updated", "AttendanceConfig", None,
        description=f"Updated attendance config: {', '.join(changed.keys())}",
    )
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
    current_user: User = Depends(require_permission("settings:leave")),
):
    obj = LeavePolicy(**payload.model_dump())
    db.add(obj)
    await log_action(
        db, current_user, "settings.leave_type_created", "LeavePolicy", None,
        description=f"Created leave type: {payload.name}",
    )
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/leave-types/{policy_id}", response_model=LeavePolicyOut)
async def update_leave_type(
    policy_id: uuid.UUID,
    payload:   LeavePolicyUpdate,
    db:        AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:leave")),
):
    result = await db.execute(select(LeavePolicy).where(LeavePolicy.id == policy_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Leave type not found")
    changed = payload.model_dump(exclude_none=True)
    for k, v in changed.items():
        setattr(obj, k, v)
    await log_action(
        db, current_user, "settings.leave_type_updated", "LeavePolicy", str(policy_id),
        description=f"Updated leave type {obj.name}: {', '.join(changed.keys())}",
    )
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/leave-types/{policy_id}", status_code=204)
async def delete_leave_type(
    policy_id: uuid.UUID,
    db:        AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:leave")),
):
    result = await db.execute(select(LeavePolicy).where(LeavePolicy.id == policy_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Leave type not found")
    await log_action(
        db, current_user, "settings.leave_type_deleted", "LeavePolicy", str(policy_id),
        description=f"Deleted leave type: {obj.name}",
    )
    await db.delete(obj)
    await db.commit()


# ── Role permissions ──────────────────────────────────────────────────────────
@router.get("/permissions/{role}", response_model=RolePermissionsOut)
async def get_permissions(
    role: str,
    db:   AsyncSession = Depends(get_db),
    _:    User = Depends(require_permission("settings:roles")),
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
    current_user: User = Depends(require_permission("settings:roles")),
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
    await log_action(
        db, current_user, "settings.permissions_updated", "RolePermission", None,
        description=f"Updated permissions for role '{role}': modules {list(payload.permissions.keys())}",
    )
    await db.commit()

    return await get_permissions(role, db, current_user)


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


# ── Custom Roles CRUD ────────────────────────────────────────────────────────
from app.models.permission import CustomRole, PERMISSIONS
import json as _json

@router.get("/custom-roles")
async def list_custom_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("settings:roles")),
):
    result = await db.execute(select(CustomRole).where(CustomRole.is_active == True))
    roles = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "display_name": r.display_name,
            "description": r.description,
            "permissions": _json.loads(r.permissions) if r.permissions else [],
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in roles
    ]


@router.get("/available-permissions")
async def list_available_permissions(
    _: User = Depends(require_permission("settings:roles")),
):
    """Return all available permission codes grouped by module."""
    grouped: dict = {}
    for code, (module, action, desc) in PERMISSIONS.items():
        grouped.setdefault(module, []).append({"code": code, "action": action, "description": desc})
    return grouped


@router.post("/custom-roles", status_code=201)
async def create_custom_role(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:roles")),
):
    name = payload.get("name", "").strip().lower().replace(" ", "_")
    display_name = payload.get("display_name", name)
    description = payload.get("description")
    permissions = payload.get("permissions", [])

    if not name:
        raise HTTPException(400, "Role name is required")

    # Validate permission codes
    valid_codes = set(PERMISSIONS.keys())
    invalid = [p for p in permissions if p not in valid_codes]
    if invalid:
        raise HTTPException(400, f"Invalid permissions: {invalid}")

    # Check duplicate
    existing = (await db.execute(select(CustomRole).where(CustomRole.name == name))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, f"Role '{name}' already exists")

    role = CustomRole(
        name=name,
        display_name=display_name,
        description=description,
        permissions=_json.dumps(permissions),
        created_by=current_user.id,
    )
    db.add(role)
    await log_action(
        db, current_user, "settings.custom_role_created", "CustomRole", None,
        description=f"Created custom role: {display_name}",
    )
    await db.commit()
    await db.refresh(role)
    return {
        "id": str(role.id),
        "name": role.name,
        "display_name": role.display_name,
        "permissions": permissions,
    }


@router.patch("/custom-roles/{role_id}")
async def update_custom_role(
    role_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:roles")),
):
    result = await db.execute(select(CustomRole).where(CustomRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Custom role not found")

    if "display_name" in payload:
        role.display_name = payload["display_name"]
    if "description" in payload:
        role.description = payload["description"]
    if "permissions" in payload:
        valid_codes = set(PERMISSIONS.keys())
        invalid = [p for p in payload["permissions"] if p not in valid_codes]
        if invalid:
            raise HTTPException(400, f"Invalid permissions: {invalid}")
        role.permissions = _json.dumps(payload["permissions"])

    await log_action(
        db, current_user, "settings.custom_role_updated", "CustomRole", str(role_id),
        description=f"Updated custom role: {role.display_name}",
    )
    await db.commit()
    await db.refresh(role)
    return {
        "id": str(role.id),
        "name": role.name,
        "display_name": role.display_name,
        "permissions": _json.loads(role.permissions),
    }


@router.delete("/custom-roles/{role_id}", status_code=204)
async def delete_custom_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings:roles")),
):
    result = await db.execute(select(CustomRole).where(CustomRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "Custom role not found")
    role.is_active = False
    await log_action(
        db, current_user, "settings.custom_role_deleted", "CustomRole", str(role_id),
        description=f"Deactivated custom role: {role.display_name}",
    )
    await db.commit()
