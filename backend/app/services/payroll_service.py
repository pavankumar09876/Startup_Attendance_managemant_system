"""
Payroll service layer — pure business logic, no HTTP/FastAPI imports.

Raises ServiceError for domain-level problems that routers translate to HTTPException.
"""
import io
import uuid
import calendar as _calendar
from datetime import date as _date, datetime, timezone
from decimal import Decimal
from calendar import month_name
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payroll import PayrollEntry, PayrollStatus, LeaveBalance
from app.models.user import User
from app.models.leave import Leave, LeaveStatus as _LeaveStatus
from app.models.settings import LeavePolicy
from app.services.statutory import calculate_all_statutory
from app.services.exceptions import ServiceError


# ── Salary calculation ───────────────────────────────────────────────────────
def calculate_entry(
    user: User,
    month: int,
    year: int,
    lop_days: int = 0,
    regime: str = "new",
) -> PayrollEntry:
    """Compute all salary components with Indian statutory compliance.

    Returns an *unsaved* PayrollEntry (caller must ``db.add()`` if persisting).
    """
    base         = Decimal(str(user.salary or 0))
    working_days = 26  # standard

    # Earnings
    basic   = base
    hra     = (base * Decimal("0.40")).quantize(Decimal("0.01"))
    travel  = Decimal("1500.00")
    gross   = (basic + hra + travel).quantize(Decimal("0.01"))

    # Loss-of-pay deduction (proportional)
    lop_amount = Decimal(0)
    if lop_days > 0 and working_days > 0:
        lop_amount = (gross / working_days * lop_days).quantize(Decimal("0.01"))
        gross     -= lop_amount

    # Statutory calculations
    annual_gross     = gross * 12
    months_remaining = 13 - month  # remaining months in FY
    statutory = calculate_all_statutory(
        basic=basic, gross=gross, annual_gross=annual_gross,
        months_remaining=months_remaining, regime=regime,
    )

    pf_emp  = statutory["epf_employee"]
    pf_er   = statutory["epf_employer"]
    esi_emp = statutory["esi_employee"]
    esi_er  = statutory["esi_employer"]
    pt      = statutory["professional_tax"]
    tds     = statutory["tds"]

    total_ded = (pf_emp + esi_emp + pt + tds + lop_amount).quantize(Decimal("0.01"))
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
        pf_deduction     = pf_emp,
        pf_employer      = pf_er,
        esi_deduction    = esi_emp,
        esi_employer     = esi_er,
        tds_deduction    = tds,
        professional_tax = pt,
        lop_deduction    = lop_amount,
        total_deductions = total_ded,
        net_salary       = net,
        working_days     = working_days,
        paid_days        = paid_days,
        lop_days         = lop_days,
        tax_regime       = regime,
        status           = PayrollStatus.PROCESSED,
        processed_at     = datetime.now(timezone.utc),
    )


# ── Run payroll ──────────────────────────────────────────────────────────────
async def run_payroll(
    db: AsyncSession,
    month: int,
    year: int,
    processed_by_id: uuid.UUID,
) -> list[PayrollEntry]:
    """Create payroll entries for every active employee for the given month.

    Raises ``ServiceError`` if payroll has already been run for this period.
    Returns a list of *committed & refreshed* PayrollEntry objects.
    """
    # Guard: already run?
    existing = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month == month,
            PayrollEntry.year  == year,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        raise ServiceError(f"Payroll for {month}/{year} already processed.")

    # Fetch all active employees
    emp_result = await db.execute(select(User).where(User.is_active == True))
    employees  = emp_result.scalars().all()

    month_start = _date(year, month, 1)
    month_end   = _date(year, month, _calendar.monthrange(year, month)[1])

    entries: list[PayrollEntry] = []
    for emp in employees:
        # Count approved unpaid leave days that fall within this payroll month
        lop_res = await db.execute(
            select(Leave).where(
                Leave.employee_id == emp.id,
                Leave.status == _LeaveStatus.APPROVED,
                Leave.leave_type == "unpaid",
                Leave.start_date <= month_end,
                Leave.end_date   >= month_start,
            )
        )
        unpaid_leaves = lop_res.scalars().all()
        lop_days = 0
        for lv in unpaid_leaves:
            # Clamp leave dates to the payroll month
            eff_start = max(lv.start_date, month_start)
            eff_end   = min(lv.end_date,   month_end)
            lop_days += (eff_end - eff_start).days + 1

        entry = calculate_entry(emp, month, year, lop_days=lop_days)
        entry.processed_by = processed_by_id
        db.add(entry)
        entries.append(entry)

    await db.flush()  # assign PKs before commit
    await db.commit()
    for e in entries:
        await db.refresh(e)
    return entries


# ── Finalize payroll ─────────────────────────────────────────────────────────
async def finalize_payroll(
    db: AsyncSession,
    month: int,
    year: int,
    finalized_by: uuid.UUID,
) -> int:
    """Move all PROCESSED entries for the period to FINALIZED.

    Returns the count of finalized entries.
    Raises ``ServiceError`` if there is nothing to finalize.
    """
    result = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month  == month,
            PayrollEntry.year   == year,
            PayrollEntry.status == PayrollStatus.PROCESSED,
        )
    )
    entries = result.scalars().all()
    if not entries:
        raise ServiceError("No processed payroll entries to finalize")

    now = datetime.now(timezone.utc)
    for entry in entries:
        entry.status       = PayrollStatus.FINALIZED
        entry.finalized_by = finalized_by
        entry.finalized_at = now

    await db.commit()
    return len(entries)


# ── Mark single entry paid ───────────────────────────────────────────────────
async def mark_entry_paid(
    db: AsyncSession,
    entry_id: uuid.UUID,
) -> PayrollEntry:
    """Mark a single payroll entry as PAID.

    Raises ``ServiceError`` if the entry does not exist.
    """
    result = await db.execute(select(PayrollEntry).where(PayrollEntry.id == entry_id))
    entry  = result.scalar_one_or_none()
    if not entry:
        raise ServiceError("Payroll entry not found", code=404)

    entry.status  = PayrollStatus.PAID
    entry.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    return entry


# ── Bulk mark paid ───────────────────────────────────────────────────────────
async def mark_all_paid(
    db: AsyncSession,
    month: int,
    year: int,
) -> int:
    """Mark all PROCESSED / FINALIZED entries for the period as PAID.

    Returns the count of updated entries.
    """
    result = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month  == month,
            PayrollEntry.year   == year,
            PayrollEntry.status.in_([PayrollStatus.PROCESSED, PayrollStatus.FINALIZED]),
        )
    )
    entries = result.scalars().all()
    now = datetime.now(timezone.utc)
    for entry in entries:
        entry.status  = PayrollStatus.PAID
        entry.paid_at = now
    await db.commit()
    return len(entries)


# ── Payroll summary ──────────────────────────────────────────────────────────
async def get_payroll_summary(
    db: AsyncSession,
    month: int,
    year: int,
) -> dict:
    """Return an aggregated summary dict for the given period.

    Keys match ``PayrollSummary`` schema fields.
    """
    result = await db.execute(
        select(PayrollEntry).where(
            PayrollEntry.month == month,
            PayrollEntry.year  == year,
        )
    )
    entries = result.scalars().all()

    total_emp_result = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )
    total_emp = total_emp_result.scalar() or 0

    return {
        "total_employees":  total_emp,
        "processed":        sum(1 for e in entries if e.status in (PayrollStatus.PROCESSED, PayrollStatus.PAID)),
        "pending":          sum(1 for e in entries if e.status == PayrollStatus.PENDING),
        "paid":             sum(1 for e in entries if e.status == PayrollStatus.PAID),
        "total_gross":      sum(e.gross_salary for e in entries) or Decimal(0),
        "total_deductions": sum(e.total_deductions for e in entries) or Decimal(0),
        "total_net":        sum(e.net_salary for e in entries) or Decimal(0),
    }


# ── Leave balance allocation ────────────────────────────────────────────────
async def allocate_leave_balances(
    db: AsyncSession,
    year: int,
) -> dict:
    """Allocate leave balances for all active employees for the given year.

    Idempotent: skips employees that already have a row for the year + leave type.
    Raises ``ServiceError`` if no leave policies are configured.
    Returns ``{"allocated": int, "year": int}``.
    """
    policy_res = await db.execute(select(LeavePolicy))
    policies = policy_res.scalars().all()
    if not policies:
        raise ServiceError("No leave policies configured")

    emp_res = await db.execute(select(User).where(User.is_active == True))
    employees = emp_res.scalars().all()

    existing_res = await db.execute(
        select(LeaveBalance).where(LeaveBalance.year == year)
    )
    existing = {
        (str(b.employee_id), b.leave_type)
        for b in existing_res.scalars().all()
    }

    created = 0
    for emp in employees:
        for policy in policies:
            if (str(emp.id), policy.name) not in existing:
                db.add(LeaveBalance(
                    employee_id=emp.id,
                    year=year,
                    leave_type=policy.name,
                    total_days=Decimal(str(policy.days_per_year)),
                    used_days=Decimal(0),
                    pending_days=Decimal(0),
                    carried_forward=Decimal(0),
                ))
                created += 1

    if created:
        await db.commit()
    return {"allocated": created, "year": year}


# ── PDF generation ───────────────────────────────────────────────────────────
async def generate_payslip_pdf(
    entry: PayrollEntry,
    employee: Optional[User],
) -> io.BytesIO:
    """Render a payslip as a PDF and return the buffer (seeked to 0).

    Raises ``ServiceError`` if reportlab is not installed.
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
        )
    except ImportError:
        raise ServiceError(
            "PDF generation requires reportlab. Install it via: pip install reportlab",
            code=500,
        )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
    )

    styles      = getSampleStyleSheet()
    title_style = ParagraphStyle('PTitle', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=20, spaceAfter=2)
    sub_style   = ParagraphStyle('PSub',   parent=styles['Normal'],   alignment=TA_CENTER, fontSize=11, textColor=colors.grey)

    period   = f"{month_name[entry.month]} {entry.year}"
    emp_name = f"{employee.first_name} {employee.last_name}" if employee else "—"
    emp_id   = employee.employee_id or "—" if employee else "—"
    dept     = (employee.department.name if employee.department else "—") if employee else "—"
    desig    = employee.designation or "—" if employee else "—"

    elements = [
        Paragraph("PAYSLIP", title_style),
        Paragraph(period, sub_style),
        Spacer(1, 8 * mm),
    ]

    # Employee info table
    info_data = [
        ["Employee Name", emp_name,     "Employee ID", emp_id],
        ["Designation",   desig,         "Department",  dept],
        ["Working Days",  str(entry.working_days), "Paid Days", str(entry.paid_days)],
        ["LOP Days",      str(entry.lop_days),     "Status",    entry.status.value.upper()],
    ]
    info_table = Table(info_data, colWidths=[42 * mm, 58 * mm, 42 * mm, 28 * mm])
    info_table.setStyle(TableStyle([
        ('FONTNAME',      (0, 0), (-1, -1), 'Helvetica'),
        ('FONTNAME',      (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME',      (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.whitesmoke, colors.white]),
    ]))
    elements += [info_table, Spacer(1, 8 * mm)]

    # Earnings & Deductions side-by-side
    def fmt(val) -> str:
        return f"\u20b9{float(val):,.2f}"

    ed_data = [
        ["EARNINGS", "Amount", "DEDUCTIONS", "Amount"],
        ["Basic Salary",      fmt(entry.basic_salary),     "PF Deduction",     fmt(entry.pf_deduction)],
        ["HRA",               fmt(entry.hra),               "ESI Deduction",    fmt(entry.esi_deduction)],
        ["Travel Allowance",  fmt(entry.travel_allowance),  "TDS Deduction",    fmt(entry.tds_deduction)],
        ["Other Allowances",  fmt(entry.other_allowances),  "LOP Deduction",    fmt(entry.lop_deduction)],
        ["Overtime Pay",      fmt(entry.overtime_pay),      "Other Deductions", fmt(entry.other_deductions)],
        ["Bonus",             fmt(entry.bonus),              "",                 ""],
        ["Gross Salary",      fmt(entry.gross_salary),      "Total Deductions", fmt(entry.total_deductions)],
    ]
    ed_table = Table(ed_data, colWidths=[50 * mm, 30 * mm, 50 * mm, 30 * mm * 1])
    ed_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND',    (0, 0), (1, 0), colors.HexColor('#1e40af')),
        ('BACKGROUND',    (2, 0), (3, 0), colors.HexColor('#991b1b')),
        ('TEXTCOLOR',     (0, 0), (-1, 0), colors.white),
        ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
        # Last data row (totals)
        ('BACKGROUND',    (0, -1), (1, -1), colors.HexColor('#dbeafe')),
        ('BACKGROUND',    (2, -1), (3, -1), colors.HexColor('#fee2e2')),
        ('FONTNAME',      (0, -1), (-1, -1), 'Helvetica-Bold'),
        # All cells
        ('FONTNAME',      (0, 1), (-1, -2), 'Helvetica'),
        ('FONTSIZE',      (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.whitesmoke]),
        ('GRID',          (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ('ALIGN',         (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN',         (3, 0), (3, -1), 'RIGHT'),
    ]))
    elements += [ed_table, Spacer(1, 8 * mm)]

    # Net salary highlight
    net_data = [["NET SALARY", fmt(entry.net_salary)]]
    net_table = Table(net_data, colWidths=[130 * mm, 40 * mm])
    net_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), colors.HexColor('#166534')),
        ('TEXTCOLOR',     (0, 0), (-1, -1), colors.white),
        ('FONTNAME',      (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, -1), 12),
        ('ALIGN',         (1, 0), (1, 0), 'RIGHT'),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (0, 0), 10),
    ]))
    elements.append(net_table)

    import asyncio as _asyncio
    await _asyncio.to_thread(doc.build, elements)
    buffer.seek(0)
    return buffer
