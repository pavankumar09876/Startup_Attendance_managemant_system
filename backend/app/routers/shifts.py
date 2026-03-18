from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.database import get_db
from app.models.shift import Shift
from app.models.user import User, Role
from app.schemas.shift import ShiftCreate, ShiftUpdate, ShiftOut
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/shifts", tags=["Shifts"])


@router.get("/", response_model=List[ShiftOut])
async def list_shifts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Shift).order_by(Shift.name))
    return result.scalars().all()


@router.post("/", response_model=ShiftOut, status_code=201)
async def create_shift(
    payload: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    shift = Shift(**payload.model_dump())
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return shift


@router.patch("/{shift_id}", response_model=ShiftOut)
async def update_shift(
    shift_id: uuid.UUID,
    payload: ShiftUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    shift = await db.get(Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(shift, k, v)
    await db.commit()
    await db.refresh(shift)
    return shift


@router.delete("/{shift_id}", status_code=204)
async def delete_shift(
    shift_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN)),
):
    shift = await db.get(Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    # Soft-delete: deactivate instead of hard delete (FK references)
    shift.is_active = False
    await db.commit()


@router.post("/{shift_id}/assign/{user_id}", status_code=204)
async def assign_shift_to_user(
    shift_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    shift = await db.get(Shift, shift_id)
    if not shift or not shift.is_active:
        raise HTTPException(status_code=404, detail="Shift not found")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.shift_id = shift_id
    await db.commit()


@router.delete("/assign/{user_id}", status_code=204)
async def unassign_shift(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.shift_id = None
    await db.commit()
