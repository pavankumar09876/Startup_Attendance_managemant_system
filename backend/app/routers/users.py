from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import uuid
import secrets
import string
import asyncio

from app.database import get_db
from app.models.user import User, Department, Role
from app.schemas.user import UserCreate, UserUpdate, UserOut, DepartmentCreate, DepartmentOut
from app.utils.security import hash_password
from app.utils.dependencies import get_current_user, require_roles
from app.utils.email import send_welcome_email


def _generate_temp_password(length: int = 12) -> str:
    """Generate a readable temporary password: letters + digits + one symbol."""
    alphabet = string.ascii_letters + string.digits
    password  = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%"),
    ]
    password += [secrets.choice(alphabet) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password)
    return "".join(password)

router = APIRouter(prefix="/users", tags=["Users"])


# ── Departments ──────────────────────────────────────────────────────────────

@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department))
    return result.scalars().all()


@router.post("/departments", response_model=DepartmentOut, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    dept = Department(**payload.model_dump())
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[UserOut])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[Role] = None,
    department_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(User)
    if role:
        q = q.where(User.role == role)
    if department_id:
        q = q.where(User.department_id == department_id)
    if is_active is not None:
        q = q.where(User.is_active == is_active)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # If caller sends a blank/placeholder password or send_welcome_email flag,
    # auto-generate a temporary password and require change on first login.
    send_email   = getattr(payload, "send_welcome_email", False)
    raw_password = payload.password.strip() if payload.password else ""
    temp_password: Optional[str] = None

    if send_email or not raw_password:
        temp_password = _generate_temp_password()
        raw_password  = temp_password

    data = payload.model_dump(exclude={"password", "send_welcome_email"})
    user = User(
        **data,
        hashed_password=hash_password(raw_password),
        must_change_password=True,   # always force on first login
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Fire-and-forget welcome email (non-blocking)
    if send_email and temp_password:
        full_name = f"{user.first_name} {user.last_name}"
        asyncio.create_task(
            asyncio.to_thread(send_welcome_email, user.email, full_name, temp_password)
        )

    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
