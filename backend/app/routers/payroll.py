"""
Payroll router — /api/payroll
Handles: run payroll, list entries, mark paid, payslips, leave balances.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
import uuid

from app.database import get_db
from app.models.payroll import PayrollEntry, PayrollStatus, LeaveBalance
from app.models.user import User, Role
from app.schemas.payroll import (
    PayrollEntryOut, RunPayrollPayload, PayrollSummary,
    LeaveBalanceOut,
)
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/payroll", tags=["Payroll"])

ADMIN_ROLES = (Role.SUPER_ADMIN, Role.ADMIN, Role.HR)


def _calculate_entry(user: User, month: int, year: int, lop_days: int = 0) -> PayrollEntry:
    """Compute all salary components from the user's base salary."""
    base        = Decimal(str(user.salary or 0))
    working_days = 26  # standard

    # Earnings
    basic   = base
    hra     = (base * Decimal("0.40")).quantize(Decimal("0.01"))
    travel  = Decimal("1500.00")
    gross   = (basic + hra + travel).quantize(Decimal("0.01"))

    # Loss of pay deduction (proportional)
    lop_amount = Decimal(0)
    if lop_days > 0 and working_days > 0:
        lop_amount = (gross / working_days * lop_days).quantize(Decimal("0.01"))
        gross     -= lop_amount

    # Deductions
    pf  = (basic * Decimal("0.12")).quantize(Decimal("0.01"))
    esi = (gross * Decimal("0.0075")).quantize(Decimal("0.01")) if gross < 21000 else Decimal(0)
    tds = Decimal("0.00")  # simplified — real TDS needs annual projection

    total_ded = (pf + esi + tds).quantize(Decimal("0.01"))
    net       = (gross - total_ded).quantize(Decimal("0.01"))

    paid_days = working_days - lop_days

    return PayrollEntry(
        employee_id      = user.id,
        month            = month,
        year             = year,
        basic_salary     = basic,
        hra              = hra,
        travel_allowance = travel,
        gross_salary     = gross,
        pf_deduction     = pf,
        esi_deduction    = esi,
        tds_deduction    = tds,
        lop_deduction    = lop_amount,
        total_deductions = total_ded,
        net_salary       = net,
        working_days     = working_days,
        paid_days        = paid_days,
        lop_days         = lop_days,
        status           = PayrollStatus.PROCESSED,
        processed_at     = datetime.now(timezone.utc),
    )


# ── List / summary ───────────────────────────────────────────────────────────
@router.get("/summary", response_model=PayrollSummary)
async def get_summary(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    _:     User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month == month,
            PayrollEntry.year  == year,
        )
    )
    entries = result.scalars().all()
    total_emp_result = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    total_emp = total_emp_result.scalar() or 0

    return PayrollSummary(
        total_employees  = total_emp,
        processed        = sum(1 for e in entries if e.status in (PayrollStatus.PROCESSED, PayrollStatus.PAID)),
        pending          = sum(1 for e in entries if e.status == PayrollStatus.PENDING),
        paid             = sum(1 for e in entries if e.status == PayrollStatus.PAID),
        total_gross      = sum(e.gross_salary for e in entries) or Decimal(0),
        total_deductions = sum(e.total_deductions for e in entries) or Decimal(0),
        total_net        = sum(e.net_salary for e in entries) or Decimal(0),
    )


@router.get("/", response_model=list[PayrollEntryOut])
async def list_entries(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    _:     User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month == month,
            PayrollEntry.year  == year,
        ).order_by(PayrollEntry.employee_id)
    )
    return result.scalars().all()


# ── Run payroll ───────────────────────────────────────────────────────────────
@router.post("/run", response_model=list[PayrollEntryOut])
async def run_payroll(
    payload:       RunPayrollPayload,
    db:            AsyncSession = Depends(get_db),
    current_user:  User = Depends(require_roles(*ADMIN_ROLES)),
):
    # Check if already run
    existing = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month == payload.month,
            PayrollEntry.year  == payload.year,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Payroll for {payload.month}/{payload.year} already processed.")

    # Fetch all active employees
    emp_result = await db.execute(select(User).where(User.is_active == True))
    employees  = emp_result.scalars().all()

    entries = []
    for emp in employees:
        entry = _calculate_entry(emp, payload.month, payload.year)
        entry.processed_by = current_user.id
        db.add(entry)
        entries.append(entry)

    await db.commit()
    for e in entries:
        await db.refresh(e)
    return entries


# ── Preview (no write) ────────────────────────────────────────────────────────
@router.get("/preview", response_model=list[PayrollEntryOut])
async def preview_payroll(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    _:     User = Depends(require_roles(*ADMIN_ROLES)),
):
    emp_result = await db.execute(select(User).where(User.is_active == True))
    employees  = emp_result.scalars().all()
    # Return calculated (unsaved) entries for preview
    return [_calculate_entry(emp, month, year) for emp in employees]


# ── Mark as paid ──────────────────────────────────────────────────────────────
@router.patch("/{entry_id}/mark-paid", response_model=PayrollEntryOut)
async def mark_paid(
    entry_id: uuid.UUID,
    db:       AsyncSession = Depends(get_db),
    _:        User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))
    entry  = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Payroll entry not found")
    entry.status  = PayrollStatus.PAID
    entry.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.post("/mark-all-paid")
async def mark_all_paid(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    _:     User = Depends(require_roles(*ADMIN_ROLES)),
):
    result = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month  == month,
            PayrollEntry.year   == year,
            PayrollEntry.status == PayrollStatus.PROCESSED,
        )
    )
    entries = result.scalars().all()
    now = datetime.now(timezone.utc)
    for entry in entries:
        entry.status  = PayrollStatus.PAID
        entry.paid_at = now
    await db.commit()
    return {"updated": len(entries)}


# ── Employee: my payslips ────────────────────────────────────────────────────
@router.get("/my", response_model=list[PayrollEntryOut])
async def my_payslips(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PayrollEntry)
        .where(PayrollEntry.employee_id == current_user.id)
        .order_by(PayrollEntry.year.desc(), PayrollEntry.month.desc())
    )
    return result.scalars().all()


@router.get("/{entry_id}", response_model=PayrollEntryOut)
async def get_payslip(
    entry_id:     uuid.UUID,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))
    entry  = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Payslip not found")
    if current_user.role == Role.EMPLOYEE and entry.employee_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    return entry


# ── Leave balances ────────────────────────────────────────────────────────────
@router.get("/leave-balances/my", response_model=list[LeaveBalanceOut])
async def my_leave_balances(
    year:         int = Query(default=None),
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not year:
        year = datetime.now().year
    result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == current_user.id,
            LeaveBalance.year == year,
        )
    )
    balances = result.scalars().all()
    return [LeaveBalanceOut.from_orm_with_remaining(b) for b in balances]
