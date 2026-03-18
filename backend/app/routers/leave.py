from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import Optional
import uuid

from app.database import get_db
from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.user import User, Role
from app.schemas.leave import (
    LeaveCreate, LeaveUpdate, LeaveOut,
    LeaveEncashmentRequest, LeaveEncashmentOut,
    LeaveBalanceOut, HolidayOut,
)
from app.utils.dependencies import get_current_user, require_roles, require_permission
from app.utils.scoping import scope_query
from app.utils.audit import log_action
from app.routers.notifications_router import push_notification
from app.models.notification import NotificationType
from app.models.settings import Holiday
from app.services.exceptions import ServiceError
from app.services.leave_service import (
    apply_leave as svc_apply_leave,
    review_leave as svc_review_leave,
    cancel_leave as svc_cancel_leave,
    bulk_approve_leaves as svc_bulk_approve_leaves,
    get_leave_balances as svc_get_leave_balances,
    encash_leave as svc_encash_leave,
)

router = APIRouter(prefix="/leaves", tags=["Leave"])


# ---------------------------------------------------------------------------
# Helper: convert ServiceError -> HTTPException
# ---------------------------------------------------------------------------

def _raise_service_error(e: ServiceError):
    raise HTTPException(status_code=e.code, detail=e.message)


# ---------------------------------------------------------------------------
# GET /leaves/my
# ---------------------------------------------------------------------------

@router.get("/my", response_model=list[LeaveOut])
async def my_leaves(
    status: Optional[LeaveStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's own leave history."""
    q = select(Leave).where(Leave.employee_id == current_user.id)
    if status:
        q = q.where(Leave.status == status)
    q = q.order_by(Leave.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# GET /leaves/
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[LeaveOut])
async def list_leaves(
    employee_id: Optional[uuid.UUID] = None,
    status: Optional[LeaveStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("leave:view_own", "leave:view_team", "leave:view_all")),
):
    q = scope_query(select(Leave), current_user, employee_id_col=Leave.employee_id)
    if employee_id and current_user.role not in (Role.EMPLOYEE,):
        q = q.where(Leave.employee_id == employee_id)
    if status:
        q = q.where(Leave.status == status)
    q = q.order_by(Leave.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# GET /leaves/balances
# ---------------------------------------------------------------------------

@router.get("/balances", response_model=list[LeaveBalanceOut])
async def my_balances(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's leave balances for the current year."""
    year = date.today().year
    try:
        balances = await svc_get_leave_balances(db, current_user.id, year)
    except ServiceError as e:
        _raise_service_error(e)
    return [LeaveBalanceOut(**b) for b in balances]


# ---------------------------------------------------------------------------
# GET /leaves/holidays
# ---------------------------------------------------------------------------

@router.get("/holidays", response_model=list[HolidayOut])
async def list_holidays(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get holidays for a given year (defaults to current year)."""
    yr = year or date.today().year
    from sqlalchemy import extract
    result = await db.execute(
        select(Holiday)
        .where(extract("year", Holiday.date) == yr)
        .order_by(Holiday.date)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# POST /leaves/bulk-approve
# ---------------------------------------------------------------------------

@router.post("/bulk-approve")
async def bulk_approve(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("leave:approve")),
):
    """Bulk approve multiple leave requests."""
    ids = payload.get("ids", [])
    try:
        updated = await svc_bulk_approve_leaves(db, ids, current_user)
    except ServiceError as e:
        _raise_service_error(e)

    # Audit log
    await log_action(
        db, current_user, "leave.bulk_approved", "Leave", None,
        description=f"Bulk approved {updated} leave requests",
        metadata={"leave_ids": [str(i) for i in ids]},
    )
    await db.commit()

    return {"updated": updated}


# ---------------------------------------------------------------------------
# POST /leaves/
# ---------------------------------------------------------------------------

@router.post("/", response_model=LeaveOut, status_code=201)
async def apply_leave(
    payload: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        leave = await svc_apply_leave(db, current_user.id, payload.model_dump())
    except ServiceError as e:
        _raise_service_error(e)
    return leave


# ---------------------------------------------------------------------------
# POST /leaves/comp-off
# ---------------------------------------------------------------------------

@router.post("/comp-off", response_model=LeaveOut, status_code=201)
async def request_comp_off(
    payload: LeaveCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Shortcut endpoint to request comp-off leave."""
    if payload.leave_type != LeaveType.COMP_OFF:
        payload.leave_type = LeaveType.COMP_OFF
    try:
        leave = await svc_apply_leave(db, current_user.id, payload.model_dump())
    except ServiceError as e:
        _raise_service_error(e)
    return leave


# ---------------------------------------------------------------------------
# POST /leaves/encash
# ---------------------------------------------------------------------------

@router.post("/encash", response_model=LeaveEncashmentOut)
async def encash_leave(
    payload: LeaveEncashmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Encash unused leave days for monetary compensation."""
    try:
        result = await svc_encash_leave(db, current_user.id, payload.leave_type, payload.days)
    except ServiceError as e:
        _raise_service_error(e)
    return LeaveEncashmentOut(**result)


# ---------------------------------------------------------------------------
# PATCH /leaves/{leave_id}/review
# ---------------------------------------------------------------------------

@router.patch("/{leave_id}/review", response_model=LeaveOut)
async def review_leave(
    leave_id: uuid.UUID,
    payload: LeaveUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("leave:approve")),
):
    try:
        leave = await svc_review_leave(
            db, leave_id, current_user, payload.status, payload.rejection_reason,
        )
    except ServiceError as e:
        _raise_service_error(e)

    # Audit log
    await log_action(
        db, current_user, f"leave.{payload.status.value}", "Leave", str(leave.id),
        description=f"{payload.status.value} leave for employee {leave.employee_id}",
    )
    await db.commit()

    # Fire in-app notification to the employee
    if payload.status == LeaveStatus.APPROVED:
        await push_notification(
            db=db,
            user_id=leave.employee_id,
            type_=NotificationType.LEAVE_APPROVED,
            title="Leave Approved",
            message=f"Your {leave.leave_type} leave ({leave.start_date} – {leave.end_date}) has been approved.",
            link="/leave",
        )
    elif payload.status == LeaveStatus.REJECTED:
        reason_text = f" Reason: {leave.rejection_reason}" if leave.rejection_reason else ""
        await push_notification(
            db=db,
            user_id=leave.employee_id,
            type_=NotificationType.LEAVE_REJECTED,
            title="Leave Rejected",
            message=f"Your {leave.leave_type} leave ({leave.start_date} – {leave.end_date}) was rejected.{reason_text}",
            link="/leave",
        )

    return leave


# ---------------------------------------------------------------------------
# PATCH /leaves/{leave_id}/cancel
# ---------------------------------------------------------------------------

@router.patch("/{leave_id}/cancel", response_model=LeaveOut)
async def cancel_leave_patch(
    leave_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a pending leave (PATCH variant used by frontend)."""
    try:
        leave = await svc_cancel_leave(db, leave_id, current_user)
    except ServiceError as e:
        _raise_service_error(e)
    return leave


# ---------------------------------------------------------------------------
# DELETE /leaves/{leave_id}
# ---------------------------------------------------------------------------

@router.delete("/{leave_id}", status_code=204)
async def cancel_leave(
    leave_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await svc_cancel_leave(db, leave_id, current_user)
    except ServiceError as e:
        _raise_service_error(e)
