"""
Leave service layer — pure business logic, no HTTP/FastAPI dependencies.

All functions accept an AsyncSession and return data or raise ServiceError.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.leave import Leave, LeaveStatus, LeaveType
from app.models.user import User, Role
from app.models.attendance import Attendance, AttendanceStatus
from app.models.payroll import LeaveBalance
from app.models.settings import LeavePolicy
from app.services.leave_engine import validate_leave_request, calculate_encashment
from app.services.exceptions import ServiceError


# ---------------------------------------------------------------------------
# apply_leave
# ---------------------------------------------------------------------------

async def apply_leave(
    db: AsyncSession,
    employee_id: uuid.UUID,
    payload_dict: dict,
) -> Leave:
    """
    Validate and create a leave request.  Updates ``pending_days`` in the
    corresponding LeaveBalance row.

    Parameters
    ----------
    db : AsyncSession
    employee_id : uuid.UUID
        The employee filing the leave.
    payload_dict : dict
        Validated fields from ``LeaveCreate.model_dump()``.  Expected keys:
        ``leave_type``, ``start_date``, ``end_date``, ``reason``,
        ``is_half_day``, ``half_day_period``, ``comp_off_date``.

    Returns
    -------
    Leave
        The newly-created, refreshed ORM object.
    """
    leave_type = payload_dict["leave_type"]
    start_date = payload_dict["start_date"]
    end_date = payload_dict["end_date"]
    is_half_day = payload_dict.get("is_half_day", False)
    half_day_period = payload_dict.get("half_day_period")
    comp_off_date = payload_dict.get("comp_off_date")

    # ---- basic date validation ----
    if end_date < start_date:
        raise ServiceError("end_date must be >= start_date")

    # ---- half-day validation ----
    if is_half_day:
        if not half_day_period or half_day_period not in ("first_half", "second_half"):
            raise ServiceError("half_day_period must be 'first_half' or 'second_half'")
        if start_date != end_date:
            raise ServiceError("Half-day leave must be for a single day")

    # ---- comp-off validation ----
    if leave_type == LeaveType.COMP_OFF:
        if not comp_off_date:
            raise ServiceError("comp_off_date is required for comp-off leave")
        att_res = await db.execute(
            select(Attendance).where(
                Attendance.employee_id == employee_id,
                Attendance.date == comp_off_date,
                Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.WFH]),
            )
        )
        if not att_res.scalar_one_or_none():
            raise ServiceError("No attendance record found for the comp-off date")

    # ---- policy / balance validation via leave_engine ----
    year = start_date.year
    leave_type_value = leave_type.value if hasattr(leave_type, "value") else leave_type
    valid, message, total_days = await validate_leave_request(
        db, employee_id, leave_type_value, start_date, end_date, is_half_day, year,
    )
    if not valid:
        raise ServiceError(message)

    # ---- create the leave record ----
    leave = Leave(
        **payload_dict,
        employee_id=employee_id,
        total_days=Decimal(str(total_days)),
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)

    # ---- update pending_days ----
    balance = (await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == year,
            LeaveBalance.leave_type == leave_type,
        )
    )).scalar_one_or_none()
    if balance:
        balance.pending_days = (balance.pending_days or Decimal(0)) + Decimal(str(total_days))
        await db.commit()
        await db.refresh(leave)

    return leave


# ---------------------------------------------------------------------------
# review_leave
# ---------------------------------------------------------------------------

async def review_leave(
    db: AsyncSession,
    leave_id: uuid.UUID,
    reviewer: User,
    status: LeaveStatus,
    rejection_reason: Optional[str] = None,
) -> Leave:
    """
    Approve or reject a pending leave request.

    - Validates the leave exists and is still pending.
    - If the reviewer is a MANAGER, checks they are the employee's direct manager.
    - Updates ``LeaveBalance`` (used_days / pending_days) in the same transaction.

    Returns the refreshed Leave object.  Notifications and audit logging are
    the caller's responsibility.
    """
    result = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise ServiceError("Leave request not found", code=404)
    if leave.status != LeaveStatus.PENDING:
        raise ServiceError("Leave is already reviewed")

    # manager scope check
    if reviewer.role == Role.MANAGER:
        emp_res = await db.execute(select(User).where(User.id == leave.employee_id))
        emp = emp_res.scalar_one_or_none()
        if not emp or emp.manager_id != reviewer.id:
            raise ServiceError("Can only approve your direct reports' leaves", code=403)

    leave.status = status
    leave.reviewed_by = reviewer.id
    leave.reviewed_at = datetime.now(timezone.utc)
    if rejection_reason:
        leave.rejection_reason = rejection_reason

    # ---- sync LeaveBalance ----
    year = leave.start_date.year
    balance = (await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == leave.employee_id,
            LeaveBalance.year == year,
            LeaveBalance.leave_type == leave.leave_type,
        )
    )).scalar_one_or_none()
    if balance:
        days = Decimal(str(leave.total_days))
        if status == LeaveStatus.APPROVED:
            balance.used_days = (balance.used_days or Decimal(0)) + days
            balance.pending_days = max(Decimal(0), (balance.pending_days or Decimal(0)) - days)
        elif status == LeaveStatus.REJECTED:
            balance.pending_days = max(Decimal(0), (balance.pending_days or Decimal(0)) - days)

    await db.commit()
    await db.refresh(leave)
    return leave


# ---------------------------------------------------------------------------
# cancel_leave
# ---------------------------------------------------------------------------

async def cancel_leave(
    db: AsyncSession,
    leave_id: uuid.UUID,
    cancelled_by: User,
) -> Leave:
    """
    Cancel a **pending** leave request and reverse the pending-days impact.

    Employees may only cancel their own leaves; managers/admins/HR can cancel
    any.  The permission check is done here (business rule), not in the router.

    Returns the updated Leave object.
    """
    result = await db.execute(select(Leave).where(Leave.id == leave_id))
    leave = result.scalar_one_or_none()
    if not leave:
        raise ServiceError("Leave request not found", code=404)
    if leave.employee_id != cancelled_by.id and cancelled_by.role == Role.EMPLOYEE:
        raise ServiceError("Not allowed", code=403)
    if leave.status != LeaveStatus.PENDING:
        raise ServiceError("Can only cancel pending requests")

    leave.status = LeaveStatus.CANCELLED

    # ---- reverse balance impact ----
    year = leave.start_date.year
    balance = (await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == leave.employee_id,
            LeaveBalance.year == year,
            LeaveBalance.leave_type == leave.leave_type,
        )
    )).scalar_one_or_none()
    if balance:
        days = Decimal(str(leave.total_days))
        balance.pending_days = max(Decimal(0), (balance.pending_days or Decimal(0)) - days)

    await db.commit()
    await db.refresh(leave)
    return leave


# ---------------------------------------------------------------------------
# bulk_approve_leaves
# ---------------------------------------------------------------------------

async def bulk_approve_leaves(
    db: AsyncSession,
    leave_ids: list[str],
    approver: User,
) -> int:
    """
    Approve multiple pending leave requests in a single transaction.

    Returns the number of leaves actually approved (skips non-pending).
    """
    if not leave_ids:
        raise ServiceError("No leave IDs provided")

    updated = 0
    for lid in leave_ids:
        result = await db.execute(select(Leave).where(Leave.id == uuid.UUID(lid)))
        leave = result.scalar_one_or_none()
        if leave and leave.status == LeaveStatus.PENDING:
            leave.status = LeaveStatus.APPROVED
            leave.reviewed_by = approver.id
            leave.reviewed_at = datetime.now(timezone.utc)
            updated += 1

            # sync balance
            yr = leave.start_date.year
            balance = (await db.execute(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == leave.employee_id,
                    LeaveBalance.year == yr,
                    LeaveBalance.leave_type == leave.leave_type,
                )
            )).scalar_one_or_none()
            if balance:
                days = Decimal(str(leave.total_days))
                balance.used_days = (balance.used_days or Decimal(0)) + days
                balance.pending_days = max(Decimal(0), (balance.pending_days or Decimal(0)) - days)

    await db.commit()
    return updated


# ---------------------------------------------------------------------------
# get_leave_balances
# ---------------------------------------------------------------------------

async def get_leave_balances(
    db: AsyncSession,
    employee_id: uuid.UUID,
    year: int,
) -> list[dict]:
    """
    Return a list of leave-balance dicts for the given employee and year.

    Each dict has: ``leave_type``, ``total``, ``used``, ``remaining``.
    """
    result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == year,
        )
    )
    balances = result.scalars().all()
    return [
        {
            "leave_type": b.leave_type,
            "total": float(b.total_days or 0),
            "used": float(b.used_days or 0),
            "remaining": (
                float(b.total_days or 0)
                - float(b.used_days or 0)
                - float(b.pending_days or 0)
            ),
        }
        for b in balances
    ]


# ---------------------------------------------------------------------------
# encash_leave
# ---------------------------------------------------------------------------

async def encash_leave(
    db: AsyncSession,
    employee_id: uuid.UUID,
    leave_type: LeaveType,
    days: float,
) -> dict:
    """
    Encash unused leave days for monetary compensation.

    Returns a dict with ``employee_id``, ``leave_type``, ``days``,
    ``daily_salary``, ``amount``, ``status``.
    """
    year = date.today().year

    # ---- policy check ----
    leave_type_value = leave_type.value if hasattr(leave_type, "value") else leave_type
    policy_res = await db.execute(
        select(LeavePolicy).where(LeavePolicy.name.ilike(f"%{leave_type_value}%"))
    )
    policy = policy_res.scalar_one_or_none()
    if not policy or not policy.encashment_allowed:
        raise ServiceError("Encashment is not allowed for this leave type")

    if policy.encashment_max_days and days > policy.encashment_max_days:
        raise ServiceError(f"Maximum encashable days: {policy.encashment_max_days}")

    # ---- balance check (row-locked) ----
    balance_res = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == year,
            LeaveBalance.leave_type == leave_type,
        ).with_for_update()
    )
    balance = balance_res.scalar_one_or_none()
    if not balance:
        raise ServiceError("No leave balance found")

    available = (
        float(balance.total_days or 0)
        - float(balance.used_days or 0)
        - float(balance.pending_days or 0)
    )
    if days > available:
        raise ServiceError(f"Insufficient balance. Available: {available:.1f} days")

    # ---- salary calculation ----
    emp_res = await db.execute(select(User).where(User.id == employee_id))
    emp = emp_res.scalar_one_or_none()
    salary = float(emp.salary or 0) if emp else 0
    if salary <= 0:
        raise ServiceError("Salary not configured for this employee")
    daily_salary = salary / 30.0
    amount = calculate_encashment(daily_salary, days)

    # ---- deduct from balance ----
    balance.used_days = (balance.used_days or Decimal(0)) + Decimal(str(days))
    await db.commit()

    return {
        "employee_id": employee_id,
        "leave_type": leave_type,
        "days": days,
        "daily_salary": round(daily_salary, 2),
        "amount": amount,
        "status": "approved",
    }
