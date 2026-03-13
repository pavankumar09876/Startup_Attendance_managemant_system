from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, datetime, timezone
from typing import Optional
import uuid

from app.database import get_db
from app.models.leave import Leave, LeaveStatus
from app.models.user import User, Role
from app.schemas.leave import LeaveCreate, LeaveUpdate, LeaveOut
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/leaves", tags=["Leave"])


@router.get("/", response_model=list[LeaveOut])
async def list_leaves(
    employee_id: Optional[uuid.UUID] = None,
    status: Optional[LeaveStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Leave)
    if current_user.role == Role.EMPLOYEE:
        q = q.where(Leave.employee_id == current_user.id)
    elif employee_id:
        q = q.where(Leave.employee_id == employee_id)
    if status:
        q = q.where(Leave.status == status)
    q = q.order_by(Leave.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=LeaveOut, status_code=201)
async def apply_leave(
    payload: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    total_days = (payload.end_date - payload.start_date).days + 1
    leave = Leave(
        **payload.model_dump(),
        employee_id=current_user.id,
        total_days=total_days,
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    return leave


@router.patch("/{leave_id}/review", response_model=LeaveOut)
async def review_leave(
    leave_id: uuid.UUID,
    payload: LeaveUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER)),
):
    result = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Leave is already reviewed")

    leave.status = payload.status
    leave.reviewed_by = current_user.id
    leave.reviewed_at = datetime.now(timezone.utc)
    if payload.rejection_reason:
        leave.rejection_reason = payload.rejection_reason

    await db.commit()
    await db.refresh(leave)
    return leave


@router.delete("/{leave_id}", status_code=204)
async def cancel_leave(
    leave_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if leave.employee_id != current_user.id and current_user.role == Role.EMPLOYEE:
        raise HTTPException(status_code=403, detail="Not allowed")
    if leave.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")

    leave.status = LeaveStatus.CANCELLED
    await db.commit()
