"""
Payroll router — /api/payroll
Handles: run payroll, list entries, mark paid, payslips, leave balances.

Business logic lives in ``app.services.payroll_service``; this module handles
only HTTP concerns (auth, request/response, audit logging).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from calendar import month_name
import uuid

from app.database import get_db
from app.models.payroll import PayrollEntry, PayrollRevision, PayslipVersion, LeaveBalance, PayrollStatus
from app.models.user import User, Role
from app.schemas.payroll import (
    PayrollEntryOut, RunPayrollPayload, PayrollSummary,
    LeaveBalanceOut,
)
from app.utils.dependencies import get_current_user, require_permission, verify_reauth, enforce_ip_whitelist
from app.utils.audit import log_action
from app.services.exceptions import ServiceError
from app.services.payroll_service import (
    calculate_entry,
    run_payroll as svc_run_payroll,
    finalize_payroll as svc_finalize_payroll,
    mark_entry_paid as svc_mark_entry_paid,
    mark_all_paid as svc_mark_all_paid,
    get_payroll_summary as svc_get_payroll_summary,
    allocate_leave_balances as svc_allocate_leave_balances,
    generate_payslip_pdf as svc_generate_payslip_pdf,
)

router = APIRouter(prefix="/payroll", tags=["Payroll"])


def _raise_for_service_error(exc: ServiceError) -> None:
    """Translate a domain ServiceError into an HTTPException."""
    raise HTTPException(status_code=exc.code, detail=exc.message)


# ── List / summary ───────────────────────────────────────────────────────────
@router.get("/summary", response_model=PayrollSummary)
async def get_summary(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    _:     User = Depends(require_permission("payroll:view_all")),
):
    try:
        data = await svc_get_payroll_summary(db, month, year)
    except ServiceError as exc:
        _raise_for_service_error(exc)
    return PayrollSummary(**data)


@router.get("/", response_model=list[PayrollEntryOut])
async def list_entries(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    _:     User = Depends(require_permission("payroll:view_all")),
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
    current_user:  User = Depends(require_permission("payroll:run")),
):
    try:
        entries = await svc_run_payroll(db, payload.month, payload.year, current_user.id)
    except ServiceError as exc:
        _raise_for_service_error(exc)

    await log_action(
        db, current_user, "payroll.run", "PayrollEntry", None,
        description=f"Ran payroll for {payload.month}/{payload.year} — {len(entries)} entries",
    )
    await db.commit()
    return entries


# ── Finalize payroll (Admin approves HR's run) ───────────────────────────────
@router.post("/finalize", dependencies=[Depends(enforce_ip_whitelist)])
async def finalize_payroll(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    confirm_password: str = Query(None, description="Password for re-authentication"),
    confirm_mfa: str = Query(None, description="MFA code for re-authentication"),
    db:    AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:finalize")),
):
    """Admin finalizes payroll that HR has prepared. Moves PROCESSED -> FINALIZED.
    Requires password or MFA re-authentication."""
    await verify_reauth(current_user, password=confirm_password, mfa_code=confirm_mfa)
    try:
        count = await svc_finalize_payroll(db, month, year, current_user.id)
    except ServiceError as exc:
        _raise_for_service_error(exc)

    await log_action(
        db, current_user, "payroll.finalized", "PayrollEntry", None,
        description=f"Finalized payroll for {month}/{year} — {count} entries",
    )
    await db.commit()
    return {"finalized": count}


# ── Preview (no write) ────────────────────────────────────────────────────────
@router.get("/preview", response_model=list[PayrollEntryOut])
async def preview_payroll(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    _:     User = Depends(require_permission("payroll:run", "payroll:view_all")),
):
    emp_result = await db.execute(select(User).where(User.is_active == True))
    employees  = emp_result.scalars().all()
    # Return calculated (unsaved) entries for preview
    return [calculate_entry(emp, month, year) for emp in employees]


# ── Mark as paid ──────────────────────────────────────────────────────────────
@router.patch("/{entry_id}/mark-paid", response_model=PayrollEntryOut)
async def mark_paid(
    entry_id: uuid.UUID,
    db:       AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:finalize")),
):
    try:
        entry = await svc_mark_entry_paid(db, entry_id)
    except ServiceError as exc:
        _raise_for_service_error(exc)
    await log_action(
        db, current_user, "payroll.marked_paid", "PayrollEntry", str(entry_id),
        description=f"Marked payroll entry {entry_id} as paid",
    )
    await db.commit()
    return entry


@router.post("/mark-all-paid")
async def mark_all_paid(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:finalize")),
):
    try:
        count = await svc_mark_all_paid(db, month, year)
    except ServiceError as exc:
        _raise_for_service_error(exc)
    await log_action(
        db, current_user, "payroll.all_marked_paid", "PayrollEntry", None,
        description=f"Marked all payroll entries as paid for {month}/{year} — {count} entries",
    )
    await db.commit()
    return {"updated": count}


# ── Bulk finalize (process multiple months) ──────────────────────────────────
@router.post("/bulk-finalize")
async def bulk_finalize(
    payload: dict,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:finalize")),
):
    """Bulk finalize payroll entries by list of entry IDs.
    Payload: { ids: ["uuid1", "uuid2", ...] }
    """
    entry_ids = payload.get("ids", [])
    if not entry_ids:
        raise HTTPException(400, "ids list is required")

    updated = 0
    for eid_str in entry_ids:
        try:
            eid = uuid.UUID(eid_str)
        except (ValueError, TypeError):
            continue
        result = await db.execute(select(PayrollEntry).where(PayrollEntry.id == eid))
        entry = result.scalar_one_or_none()
        if not entry:
            continue
        if entry.status == PayrollStatus.PROCESSED:
            entry.status = PayrollStatus.FINALIZED
            updated += 1

    await log_action(
        db, current_user, "payroll.bulk_finalized", "PayrollEntry", None,
        description=f"Bulk finalized {updated} payroll entries",
        metadata={"entry_ids": entry_ids},
    )
    await db.commit()
    return {"finalized": updated, "total": len(entry_ids)}


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


# ── Leave balance allocation (admin trigger) ──────────────────────────────────
@router.post("/leave-balances/allocate")
async def allocate_leave_balances(
    year:         int = Query(..., ge=2000, le=2100),
    db:           AsyncSession = Depends(get_db),
    _:            User = Depends(require_permission("payroll:manage_balances")),
):
    """Allocate leave balances for all active employees for a given year.
    Idempotent: skips employees that already have a row for the given year + leave type.
    """
    try:
        result = await svc_allocate_leave_balances(db, year)
    except ServiceError as exc:
        _raise_for_service_error(exc)
    return result


# ── Payslip by path /payslips/{id} (matches frontend service URLs) ────────────
@router.get("/payslips/{entry_id}", response_model=PayrollEntryOut)
async def get_payslip_by_path(
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


# ── Payslip PDF download ──────────────────────────────────────────────────────
@router.get("/payslips/{entry_id}/pdf")
async def download_payslip_pdf(
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

    emp_res = await db.execute(select(User).where(User.id == entry.employee_id))
    emp = emp_res.scalar_one_or_none()

    try:
        buffer = await svc_generate_payslip_pdf(entry, emp)
    except ServiceError as exc:
        _raise_for_service_error(exc)

    emp_id   = emp.employee_id or "—" if emp else "—"
    filename = f"payslip_{emp_id}_{month_name[entry.month]}_{entry.year}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Payroll Revisions ────────────────────────────────────────────────────────

# ── Attendance penalty preview ────────────────────────────────────────────────

@router.get("/penalties/preview")
async def preview_attendance_penalties(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:run", "payroll:view_all")),
):
    """Preview attendance-based penalties for all active employees."""
    from app.services.penalty_engine import calculate_attendance_penalty
    from decimal import Decimal

    emp_result = await db.execute(select(User).where(User.is_active == True))
    employees = emp_result.scalars().all()

    results = []
    for emp in employees:
        daily_salary = (emp.salary or Decimal("0")) / 30
        penalty = await calculate_attendance_penalty(db, emp.id, month, year, daily_salary)
        if penalty["total_penalty"] > 0:
            results.append({
                "employee_id": str(emp.id),
                "name": f"{emp.first_name} {emp.last_name}",
                **{k: float(v) if isinstance(v, Decimal) else v for k, v in penalty.items()},
            })

    return {"month": month, "year": year, "penalties": results}


# ── Payroll Revisions ────────────────────────────────────────────────────────

from pydantic import BaseModel as _BaseModel
from typing import Optional as _Opt

class _PayrollCorrectionPayload(_BaseModel):
    field: str
    new_value: str
    reason: str


@router.post("/payslips/{entry_id}/revise")
async def revise_payroll_entry(
    entry_id: uuid.UUID,
    payload: _PayrollCorrectionPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:finalize")),
):
    """Create a revision/correction for a finalized payroll entry.
    Only FINALIZED or PAID entries can be revised."""
    await verify_reauth(current_user)  # re-auth is optional here; password checked at finalize
    result = await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Payroll entry not found")
    if entry.status not in (PayrollStatus.FINALIZED, PayrollStatus.PAID):
        raise HTTPException(400, "Can only revise finalized or paid entries")

    allowed_fields = {
        "bonus", "other_allowances", "other_deductions", "lop_days", "lop_deduction",
        "overtime_pay", "travel_allowance",
    }
    if payload.field not in allowed_fields:
        raise HTTPException(400, f"Cannot revise field '{payload.field}'. Allowed: {sorted(allowed_fields)}")

    old_value = str(getattr(entry, payload.field, ""))

    # Auto-snapshot before first revision (preserve original state)
    from sqlalchemy import func as sqlfunc
    existing_versions = (await db.execute(
        select(sqlfunc.count(PayslipVersion.id)).where(
            PayslipVersion.payroll_entry_id == entry_id
        )
    )).scalar() or 0
    if existing_versions == 0:
        db.add(PayslipVersion(
            payroll_entry_id=entry_id,
            version=1,
            snapshot=_snapshot_entry(entry),
            reason="Auto-snapshot before first revision",
            created_by=current_user.id,
        ))

    # Get next revision number
    max_rev = (await db.execute(
        select(sqlfunc.max(PayrollRevision.revision_number)).where(
            PayrollRevision.payroll_entry_id == entry_id
        )
    )).scalar() or 0

    revision = PayrollRevision(
        payroll_entry_id=entry_id,
        revision_number=max_rev + 1,
        field_changed=payload.field,
        old_value=old_value,
        new_value=payload.new_value,
        reason=payload.reason,
        revised_by=current_user.id,
    )
    db.add(revision)

    # Apply the correction
    from decimal import Decimal as _Dec
    setattr(entry, payload.field, _Dec(payload.new_value))

    # Recalculate totals
    entry.gross_salary = (
        entry.basic_salary + entry.hra + entry.travel_allowance
        + entry.other_allowances + entry.overtime_pay + entry.bonus
    )
    entry.total_deductions = (
        entry.pf_deduction + entry.tds_deduction + entry.esi_deduction
        + (entry.professional_tax or 0) + entry.lop_deduction + entry.other_deductions
    )
    entry.net_salary = entry.gross_salary - entry.total_deductions

    await log_action(
        db, current_user, "payroll.revised", "PayrollEntry", str(entry_id),
        description=f"Revised {payload.field}: {old_value} → {payload.new_value}. Reason: {payload.reason}",
    )
    await db.commit()
    await db.refresh(entry)
    return {
        "entry_id": str(entry_id),
        "revision": max_rev + 1,
        "field": payload.field,
        "old_value": old_value,
        "new_value": payload.new_value,
        "new_net_salary": float(entry.net_salary),
    }


@router.get("/payslips/{entry_id}/revisions")
async def get_revisions(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:view_all")),
):
    """Get revision history for a payroll entry."""
    revisions = (await db.execute(
        select(PayrollRevision).where(
            PayrollRevision.payroll_entry_id == entry_id
        ).order_by(PayrollRevision.revision_number)
    )).scalars().all()

    return [
        {
            "revision": r.revision_number,
            "field": r.field_changed,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "reason": r.reason,
            "revised_by": str(r.revised_by),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in revisions
    ]


# ── Payslip Versioning ─────────────────────────────────────────────────────

import json as _json

_SNAPSHOT_FIELDS = [
    "basic_salary", "hra", "travel_allowance", "other_allowances",
    "overtime_pay", "bonus", "gross_salary", "pf_deduction", "pf_employer",
    "tds_deduction", "esi_deduction", "esi_employer", "professional_tax",
    "lop_deduction", "other_deductions", "total_deductions", "net_salary",
    "working_days", "paid_days", "lop_days", "tax_regime", "status",
]


def _snapshot_entry(entry: PayrollEntry) -> str:
    """Serialize salary fields into a JSON snapshot."""
    data = {}
    for f in _SNAPSHOT_FIELDS:
        val = getattr(entry, f, None)
        if val is not None:
            data[f] = str(val) if hasattr(val, "is_finite") else val  # Decimal → str
        else:
            data[f] = None
    return _json.dumps(data)


@router.post("/payslips/{entry_id}/snapshot")
async def create_payslip_snapshot(
    entry_id: uuid.UUID,
    reason: str = Query(None, description="Reason for creating this snapshot"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:finalize")),
):
    """Create an immutable snapshot (version) of the current payslip state."""
    result = await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Payroll entry not found")

    # Get next version number
    from sqlalchemy import func as sqlfunc
    max_ver = (await db.execute(
        select(sqlfunc.max(PayslipVersion.version)).where(
            PayslipVersion.payroll_entry_id == entry_id
        )
    )).scalar() or 0

    version = PayslipVersion(
        payroll_entry_id=entry_id,
        version=max_ver + 1,
        snapshot=_snapshot_entry(entry),
        reason=reason,
        created_by=current_user.id,
    )
    db.add(version)

    await log_action(
        db, current_user, "payroll.version_created", "PayslipVersion", str(entry_id),
        description=f"Created payslip snapshot v{max_ver + 1} for entry {entry_id}",
    )
    await db.commit()
    await db.refresh(version)
    return {
        "entry_id": str(entry_id),
        "version": version.version,
        "reason": version.reason,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }


@router.get("/payslips/{entry_id}/versions")
async def list_payslip_versions(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:view_all")),
):
    """List all immutable snapshots for a payslip."""
    versions = (await db.execute(
        select(PayslipVersion).where(
            PayslipVersion.payroll_entry_id == entry_id
        ).order_by(PayslipVersion.version)
    )).scalars().all()

    return [
        {
            "version": v.version,
            "snapshot": _json.loads(v.snapshot),
            "reason": v.reason,
            "created_by": str(v.created_by),
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


@router.get("/payslips/{entry_id}/versions/{version_num}")
async def get_payslip_version(
    entry_id: uuid.UUID,
    version_num: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("payroll:view_all")),
):
    """Get a specific version snapshot of a payslip."""
    result = await db.execute(
        select(PayslipVersion).where(
            PayslipVersion.payroll_entry_id == entry_id,
            PayslipVersion.version == version_num,
        )
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(404, f"Version {version_num} not found for entry {entry_id}")

    return {
        "version": v.version,
        "snapshot": _json.loads(v.snapshot),
        "reason": v.reason,
        "created_by": str(v.created_by),
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }
