"""
User service — pure business logic for user and department operations.

All functions accept an AsyncSession and return plain data.
They never import FastAPI or raise HTTPException.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Any, Dict, Optional
import uuid
import secrets
import string

from app.models.user import User, Department, Role, EmployeeStatus
from app.models.payroll import LeaveBalance
from app.models.settings import LeavePolicy
from app.utils.security import hash_password
from app.utils.scoping import scope_users
from app.utils.audit import log_action
from app.services.exceptions import ServiceError


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_temp_password(length: int = 12) -> str:
    """Generate a readable temporary password: letters + digits + one symbol."""
    alphabet = string.ascii_letters + string.digits
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%"),
    ]
    password += [secrets.choice(alphabet) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password)
    return "".join(password)


# ── Users ─────────────────────────────────────────────────────────────────────

async def list_users(
    db: AsyncSession,
    current_user: User,
    filters: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Return a paginated, scoped list of users.

    *filters* may contain: search, skip, limit, role, department_id, is_active.
    """
    search = filters.get("search")
    skip = filters.get("skip", 0)
    limit = filters.get("limit", 20)
    role = filters.get("role")
    department_id = filters.get("department_id")
    is_active = filters.get("is_active")

    q = scope_users(select(User), current_user)

    if role:
        q = q.where(User.role == role)
    if department_id:
        q = q.where(User.department_id == department_id)
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    if search:
        pattern = f"%{search}%"
        q = q.where(or_(
            User.first_name.ilike(pattern),
            User.last_name.ilike(pattern),
            User.email.ilike(pattern),
            User.employee_id.ilike(pattern),
        ))

    # Count total before pagination
    count_q = select(func.count()).select_from(q.order_by(None).subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Apply pagination
    q = q.order_by(User.created_at.desc()).offset(skip).limit(limit)
    q = q.options(selectinload(User.department))
    result = await db.execute(q)
    users = result.scalars().all()

    return {"users": users, "total": total}


async def create_user(
    db: AsyncSession,
    payload_dict: Dict[str, Any],
    created_by: User,
) -> User:
    """
    Create a new user.  Returns the fully-loaded User ORM object.

    *payload_dict* is expected to come from ``UserCreate.model_dump()``.
    The caller is responsible for Pydantic validation.
    """
    email = payload_dict.get("email")

    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise ServiceError("Email already registered", code=400)

    # ── Role assignment restriction ─────────────────────────────────────────
    requested_role = payload_dict.get("role")
    if requested_role:
        PRIVILEGED_ROLES = {Role.SUPER_ADMIN, Role.ADMIN}
        if isinstance(requested_role, str):
            requested_role = Role(requested_role)
        if requested_role in PRIVILEGED_ROLES and created_by.role != Role.SUPER_ADMIN:
            raise ServiceError(
                f"Only Super Admin can assign the {requested_role.value} role",
                code=403,
            )

    # ── Manager assignment validation ───────────────────────────────────────
    manager_id = payload_dict.get("manager_id")
    if manager_id:
        if str(manager_id) == str(payload_dict.get("id", "")):
            raise ServiceError("Employee cannot be their own manager", code=400)
        mgr = (await db.execute(
            select(User).where(User.id == manager_id, User.is_active == True)
        )).scalar_one_or_none()
        if not mgr:
            raise ServiceError("Manager not found or inactive", code=400)

    # Password handling
    send_email = payload_dict.pop("send_welcome_email", False)
    raw_password = (payload_dict.pop("password", "") or "").strip()
    temp_password: Optional[str] = None

    if send_email or not raw_password:
        temp_password = _generate_temp_password()
        raw_password = temp_password

    user = User(
        **payload_dict,
        hashed_password=hash_password(raw_password),
        must_change_password=True,
        status=EmployeeStatus.INVITED,
    )
    db.add(user)
    await db.commit()

    # Re-fetch with department eagerly loaded to avoid MissingGreenlet on serialization
    result = await db.execute(
        select(User).where(User.id == user.id).options(selectinload(User.department))
    )
    user = result.scalar_one()

    # Audit log
    await log_action(
        db, created_by, "employee.created", "User", str(user.id),
        description=f"Created employee {user.email}",
    )

    # ── Auto-allocate leave balances ────────────────────────────────────────
    from datetime import date
    from decimal import Decimal
    current_year = date.today().year
    policies = (await db.execute(select(LeavePolicy))).scalars().all()
    for policy in policies:
        db.add(LeaveBalance(
            employee_id=user.id,
            year=current_year,
            leave_type=policy.name,
            total_days=Decimal(str(policy.days_per_year)),
            used_days=Decimal(0),
            pending_days=Decimal(0),
            carried_forward=Decimal(0),
        ))

    await db.commit()

    # Return user + metadata for the router to handle email sending
    user._temp_password = temp_password          # type: ignore[attr-defined]
    user._send_welcome_email = send_email        # type: ignore[attr-defined]
    return user


async def update_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    payload_dict: Dict[str, Any],
    current_user: User,
) -> User:
    """
    Update a user with role-based field restrictions.

    Returns the refreshed User ORM object.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ServiceError("User not found", code=404)

    # Employees can only update their own profile
    if current_user.role == Role.EMPLOYEE and str(user_id) != str(current_user.id):
        raise ServiceError("Forbidden", code=403)
    # Managers can only update their direct reports
    if current_user.role == Role.MANAGER and str(user_id) != str(current_user.id):
        if user.manager_id != current_user.id:
            raise ServiceError("Can only update your direct reports", code=403)

    # Build safe update dict — employees cannot change privileged fields
    EMPLOYEE_ALLOWED = {"first_name", "last_name", "phone", "avatar_url"}
    ADMIN_ROLES = {Role.SUPER_ADMIN, Role.ADMIN, Role.HR}

    update_data = dict(payload_dict)

    if current_user.role not in ADMIN_ROLES:
        # Strip privileged fields that non-admins must not change
        for field in ("role", "salary", "department_id", "is_active", "designation"):
            update_data.pop(field, None)

    # ── Role escalation guard ───────────────────────────────────────────────
    new_role = update_data.get("role")
    if new_role:
        PRIVILEGED_ROLES = {Role.SUPER_ADMIN, Role.ADMIN}
        if isinstance(new_role, str):
            new_role = Role(new_role)
        if new_role in PRIVILEGED_ROLES and current_user.role != Role.SUPER_ADMIN:
            raise ServiceError(
                f"Only Super Admin can assign the {new_role.value} role",
                code=403,
            )

    # ── Manager self-assignment guard ───────────────────────────────────────
    new_manager = update_data.get("manager_id")
    if new_manager:
        if str(new_manager) == str(user_id):
            raise ServiceError("Employee cannot be their own manager", code=400)
        mgr = (await db.execute(
            select(User).where(User.id == new_manager, User.is_active == True)
        )).scalar_one_or_none()
        if not mgr:
            raise ServiceError("Manager not found or inactive", code=400)

    # Track sensitive field changes for audit
    SENSITIVE_FIELDS = {"role", "salary", "hra", "allowances", "is_active", "designation", "department_id", "manager_id"}
    sensitive_changes = {}
    for field, value in update_data.items():
        if hasattr(user, field):
            if field in SENSITIVE_FIELDS:
                old_val = getattr(user, field)
                if str(old_val) != str(value):
                    sensitive_changes[field] = {"from": str(old_val), "to": str(value)}
            setattr(user, field, value)

    # Audit log for sensitive changes
    if sensitive_changes:
        await log_action(
            db, current_user, "employee.updated", "User", str(user.id),
            description=f"Updated sensitive fields for {user.email}: {', '.join(sensitive_changes.keys())}",
            metadata=sensitive_changes,
        )

    await db.commit()

    # Re-fetch with department eagerly loaded
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.department))
    )
    user = result.scalar_one()
    return user


async def deactivate_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    performed_by: User,
    reason: Optional[str] = None,
) -> None:
    """Soft-delete a user by deactivating and setting TERMINATED status."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ServiceError("User not found", code=404)

    from datetime import date as _date
    user.is_active = False
    user.status = EmployeeStatus.TERMINATED
    user.termination_date = _date.today()
    user.termination_reason = reason
    await log_action(
        db, performed_by, "employee.terminated", "User", str(user.id),
        description=f"Terminated employee {user.email}",
        metadata={"reason": reason} if reason else None,
    )
    await db.commit()


async def suspend_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    performed_by: User,
    reason: Optional[str] = None,
) -> User:
    """Suspend an employee temporarily."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ServiceError("User not found", code=404)
    if user.status == EmployeeStatus.TERMINATED:
        raise ServiceError("Cannot suspend a terminated employee", code=400)

    from datetime import datetime, timezone as _tz
    user.status = EmployeeStatus.SUSPENDED
    user.suspended_at = datetime.now(_tz.utc)
    user.suspension_reason = reason
    user.is_active = False
    await log_action(
        db, performed_by, "employee.suspended", "User", str(user.id),
        description=f"Suspended employee {user.email}",
        metadata={"reason": reason} if reason else None,
    )
    await db.commit()
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.department))
    )
    return result.scalar_one()


async def reactivate_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    performed_by: User,
) -> User:
    """Reactivate a suspended employee."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ServiceError("User not found", code=404)
    if user.status == EmployeeStatus.TERMINATED:
        raise ServiceError("Cannot reactivate a terminated employee", code=400)

    user.status = EmployeeStatus.ACTIVE
    user.is_active = True
    user.suspended_at = None
    user.suspension_reason = None
    await log_action(
        db, performed_by, "employee.reactivated", "User", str(user.id),
        description=f"Reactivated employee {user.email}",
    )
    await db.commit()
    result = await db.execute(
        select(User).where(User.id == user_id).options(selectinload(User.department))
    )
    return result.scalar_one()


# ── Departments ───────────────────────────────────────────────────────────────

async def list_departments(db: AsyncSession) -> list:
    """Return all departments with head names and employee counts."""
    result = await db.execute(
        select(Department).options(selectinload(Department.head))
    )
    depts = result.scalars().all()

    # Single aggregate query for all employee counts
    emp_counts_result = await db.execute(
        select(User.department_id, func.count(User.id))
        .where(User.department_id.isnot(None))
        .group_by(User.department_id)
    )
    emp_count_map = dict(emp_counts_result.all())

    out = []
    for d in depts:
        head_name = None
        if d.head:
            head_name = f"{d.head.first_name} {d.head.last_name}"
        out.append({
            "dept": d,
            "head_name": head_name,
            "employee_count": emp_count_map.get(d.id, 0),
        })
    return out


async def create_department(
    db: AsyncSession,
    payload_dict: Dict[str, Any],
) -> Department:
    """Create a new department. Returns the ORM object."""
    dept = Department(**payload_dict)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


async def update_department(
    db: AsyncSession,
    dept_id: uuid.UUID,
    payload_dict: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Update a department. Returns a dict with the dept ORM object,
    head_name and employee_count for the router to assemble the response.
    """
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise ServiceError("Department not found", code=404)

    for key, value in payload_dict.items():
        if hasattr(dept, key):
            setattr(dept, key, value)
    await db.commit()
    await db.refresh(dept)

    # Compute head_name and employee_count
    head_name = None
    if dept.head_id:
        head_res = await db.execute(select(User).where(User.id == dept.head_id))
        head = head_res.scalar_one_or_none()
        if head:
            head_name = f"{head.first_name} {head.last_name}"

    emp_res = await db.execute(
        select(func.count(User.id)).where(User.department_id == dept.id)
    )
    emp_count = emp_res.scalar() or 0

    return {
        "dept": dept,
        "head_name": head_name,
        "employee_count": emp_count,
    }


async def delete_department(
    db: AsyncSession,
    dept_id: uuid.UUID,
) -> None:
    """Delete a department if it has no employees assigned."""
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise ServiceError("Department not found", code=404)

    # Check if department has employees
    emp_check = await db.execute(select(User).where(User.department_id == dept_id))
    if emp_check.scalars().first():
        raise ServiceError("Cannot delete — department has employees assigned", code=400)

    await db.delete(dept)
    await db.commit()


# ── Org chart ─────────────────────────────────────────────────────────────────

async def get_org_chart(db: AsyncSession) -> list:
    """Return flat list of all active users with manager_id for frontend tree building."""
    users_res = await db.execute(
        select(User).where(User.is_active == True).options(selectinload(User.department))
    )
    users = users_res.scalars().all()
    id_to_name = {str(u.id): f"{u.first_name} {u.last_name}" for u in users}

    return [
        {
            "id":           str(u.id),
            "name":         f"{u.first_name} {u.last_name}",
            "role":         u.role.value,
            "designation":  u.designation,
            "department":   u.department.name if u.department else None,
            "avatar_url":   u.avatar_url,
            "manager_id":   str(u.manager_id) if u.manager_id else None,
            "manager_name": id_to_name.get(str(u.manager_id)) if u.manager_id else None,
        }
        for u in users
    ]
