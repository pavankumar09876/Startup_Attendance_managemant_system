"""
Attendance service layer — pure business logic, no FastAPI dependency.

All functions accept ``db: AsyncSession`` as first parameter, return data
(not HTTP responses), and raise ``ServiceError`` on business-rule violations.
"""

from __future__ import annotations

import math
import os
import uuid as _uuid
from calendar import monthrange
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance, AttendanceStatus
from app.models.settings import AttendanceConfig, CompanySettings
from app.models.shift import Shift
from app.models.user import Department, Role, User
from app.services.exceptions import ServiceError


# ---------------------------------------------------------------------------
# Helper / utility functions
# ---------------------------------------------------------------------------

def calc_working_hours(
    check_in: time,
    check_out: time,
    break_minutes: Decimal | None = None,
) -> Decimal:
    """Return net working hours between *check_in* and *check_out*.

    Handles night-shift crossover (check_out earlier than check_in) and
    subtracts *break_minutes* if provided.
    """
    ref_date = date(2000, 1, 1)  # arbitrary reference; only duration matters
    ci = datetime.combine(ref_date, check_in)
    co = datetime.combine(ref_date, check_out)
    # Night shift: check-out is earlier in the day than check-in (crosses midnight)
    if co <= ci:
        co += timedelta(days=1)
    diff_hours = (co - ci).total_seconds() / 3600
    if break_minutes:
        diff_hours -= float(break_minutes) / 60
    return Decimal(str(round(max(diff_hours, 0), 2)))


async def get_shift_cutoff(user: User, db: AsyncSession) -> tuple[int, int]:
    """Return ``(cutoff_hour, cutoff_minute)`` using the employee's shift
    or falling back to company-wide defaults."""
    config_res = await db.execute(select(AttendanceConfig).limit(1))
    config = config_res.scalar_one_or_none()
    grace = config.grace_period_minutes if config else 10

    if user.shift_id:
        shift = await db.get(Shift, user.shift_id)
        if shift:
            h, m = map(int, shift.start_time.split(":"))
            grace = shift.grace_minutes
            total_min = h * 60 + m + grace
            return total_min // 60, total_min % 60

    cs_res = await db.execute(select(CompanySettings).limit(1))
    cs = cs_res.scalar_one_or_none()
    start = cs.work_start_time if cs else "09:00"
    h, m = map(int, start.split(":"))
    total_min = h * 60 + m + grace
    return total_min // 60, total_min % 60


async def get_company_timezone(db: AsyncSession) -> str:
    """Return the IANA timezone string stored in CompanySettings, defaulting
    to ``'Asia/Kolkata'``."""
    cs_res = await db.execute(select(CompanySettings).limit(1))
    cs = cs_res.scalar_one_or_none()
    return cs.timezone if cs else "Asia/Kolkata"


def _tz_obj(tz_name: str):
    """Return a ZoneInfo object for the given IANA timezone string."""
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        from backports.zoneinfo import ZoneInfo  # type: ignore[no-redef]
    return ZoneInfo(tz_name)


def _now_in_tz(tz_name: str) -> time:
    """Return the current wall-clock *time* (naive) in the given timezone."""
    return datetime.now(_tz_obj(tz_name)).time().replace(tzinfo=None)


def _today_in_tz(tz_name: str) -> date:
    """Return today's *date* in the given timezone (not the server's local date)."""
    return datetime.now(_tz_obj(tz_name)).date()


# ---------------------------------------------------------------------------
# Core service functions
# ---------------------------------------------------------------------------

async def check_in(
    db: AsyncSession,
    user: User,
    wfh: bool = False,
) -> Attendance:
    """Perform a check-in for *user*.

    Raises :class:`ServiceError` when:
    * The user has already checked in today.
    """
    tz_name = await get_company_timezone(db)
    today = _today_in_tz(tz_name)   # use company TZ, not server-local date
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == user.id,
            Attendance.date == today,
        )
    )
    if existing.scalar_one_or_none():
        raise ServiceError("Already checked in today")

    now = _now_in_tz(tz_name)

    if wfh:
        status = AttendanceStatus.WFH
    else:
        cutoff_h, cutoff_m = await get_shift_cutoff(user, db)
        is_late = now.hour > cutoff_h or (now.hour == cutoff_h and now.minute >= cutoff_m)
        status = AttendanceStatus.LATE if is_late else AttendanceStatus.PRESENT

    record = Attendance(
        employee_id=user.id,
        date=today,
        check_in=now,
        status=status,
        shift_id=user.shift_id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def check_out(db: AsyncSession, user: User) -> Attendance:
    """Perform a check-out for *user*.

    Auto-ends an active break if one is running. Calculates working hours
    and overtime.

    Raises :class:`ServiceError` when:
    * No check-in record exists for today.
    * The user has already checked out.
    """
    tz_name = await get_company_timezone(db)
    today = _today_in_tz(tz_name)
    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == user.id,
            Attendance.date == today,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise ServiceError("No check-in found for today", code=404)
    if record.check_out:
        raise ServiceError("Already checked out")

    now = _now_in_tz(tz_name)

    # If on a break, end it automatically
    if record.on_break and record.break_start and not record.break_end:
        record.break_end = now
        bs = datetime.combine(today, record.break_start)
        be = datetime.combine(today, now)
        if be < bs:
            be += timedelta(days=1)
        record.break_minutes = Decimal(str(round((be - bs).total_seconds() / 60, 2)))
        record.on_break = False

    record.check_out = now
    record.working_hours = calc_working_hours(record.check_in, now, record.break_minutes)
    std_hours = Decimal("8.0")
    if record.working_hours > std_hours:
        record.overtime_hours = record.working_hours - std_hours

    await db.commit()
    await db.refresh(record)
    return record


async def check_in_geo(
    db: AsyncSession,
    user: User,
    latitude: float,
    longitude: float,
    selfie_file: Any | None = None,
) -> Attendance:
    """Geo-fenced check-in with optional selfie upload.

    *selfie_file* should be an ``UploadFile``-like object (with ``.filename``
    and an async ``.read()`` method) or ``None``.

    Raises :class:`ServiceError` when:
    * The user is outside the geofence radius.
    * The selfie format or size is invalid.
    * The user has already checked in today.
    """
    # ── Geofence validation ─────────────────────────────────────────────
    config_res = await db.execute(select(AttendanceConfig).limit(1))
    config = config_res.scalar_one_or_none()

    if config and config.office_lat and config.office_lng and config.geofence_radius_meters:
        R = 6_371_000  # Earth radius in metres
        lat1, lon1 = math.radians(config.office_lat), math.radians(config.office_lng)
        lat2, lon2 = math.radians(latitude), math.radians(longitude)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        dist = R * 2 * math.asin(math.sqrt(a))
        if dist > config.geofence_radius_meters:
            raise ServiceError(
                f"You are {int(dist)}m from the office (max {config.geofence_radius_meters}m)."
            )

    # ── Selfie handling ─────────────────────────────────────────────────
    ALLOWED_SELFIE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
    MAX_SELFIE_SIZE = 5 * 1024 * 1024  # 5 MB

    selfie_url: str | None = None
    if selfie_file:
        safe_selfie_name = os.path.basename(selfie_file.filename or "selfie.jpg")
        ext = os.path.splitext(safe_selfie_name)[1].lower()
        if ext not in ALLOWED_SELFIE_EXTENSIONS:
            raise ServiceError("Selfie must be a JPG, PNG, or WebP image")
        content = await selfie_file.read()
        if len(content) > MAX_SELFIE_SIZE:
            raise ServiceError("Selfie image must be under 5MB", code=413)
        upload_dir = "uploads/selfies"
        os.makedirs(upload_dir, exist_ok=True)
        fname = f"{_uuid.uuid4()}{ext}"
        path = os.path.join(upload_dir, fname)
        try:
            with open(path, "wb") as f:
                f.write(content)
        except OSError as e:
            raise ServiceError(f"Failed to save selfie: {e}", code=500)
        selfie_url = f"/uploads/selfies/{fname}"

    # ── Normal check-in logic ───────────────────────────────────────────
    tz_name = await get_company_timezone(db)
    today = _today_in_tz(tz_name)
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == user.id,
            Attendance.date == today,
        )
    )
    if existing.scalar_one_or_none():
        raise ServiceError("Already checked in today")

    now = _now_in_tz(tz_name)
    cutoff_h, cutoff_m = await get_shift_cutoff(user, db)
    is_late = now.hour > cutoff_h or (now.hour == cutoff_h and now.minute >= cutoff_m)
    status = AttendanceStatus.LATE if is_late else AttendanceStatus.PRESENT

    record = Attendance(
        employee_id=user.id,
        date=today,
        check_in=now,
        status=status,
        shift_id=user.shift_id,
        notes=selfie_url,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def start_break(db: AsyncSession, user: User) -> Attendance:
    """Start a break for *user*.

    Raises :class:`ServiceError` when:
    * The user has not checked in today.
    * The user has already checked out.
    * The user is already on a break.
    """
    tz_name = await get_company_timezone(db)
    today = _today_in_tz(tz_name)
    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == user.id,
            Attendance.date == today,
        )
    )
    record = result.scalar_one_or_none()
    if not record or not record.check_in:
        raise ServiceError("Not checked in today")
    if record.check_out:
        raise ServiceError("Already checked out")
    if record.on_break:
        raise ServiceError("Already on a break")

    tz_name = await get_company_timezone(db)
    now = _now_in_tz(tz_name)

    record.break_start = now
    record.on_break = True
    await db.commit()
    await db.refresh(record)
    return record


async def end_break(db: AsyncSession, user: User) -> Attendance:
    """End the current break for *user* and accumulate break time.

    Raises :class:`ServiceError` when:
    * The user is not currently on a break.
    """
    tz_name = await get_company_timezone(db)
    today = _today_in_tz(tz_name)
    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == user.id,
            Attendance.date == today,
        )
    )
    record = result.scalar_one_or_none()
    if not record or not record.on_break:
        raise ServiceError("Not currently on a break")

    tz_name = await get_company_timezone(db)
    now = _now_in_tz(tz_name)

    record.break_end = now
    record.on_break = False

    # Accumulate break minutes (supports multiple breaks)
    bs = datetime.combine(today, record.break_start)
    be = datetime.combine(today, now)
    if be < bs:
        be += timedelta(days=1)
    new_break = Decimal(str(round((be - bs).total_seconds() / 60, 2)))
    record.break_minutes = (record.break_minutes or Decimal("0")) + new_break

    await db.commit()
    await db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Query / reporting helpers
# ---------------------------------------------------------------------------

async def get_attendance_summary(
    db: AsyncSession,
    employee_id: _uuid.UUID,
    month: int,
    year: int,
) -> dict:
    """Return a monthly attendance summary dict for *employee_id*.

    Keys: ``total_days``, ``present``, ``absent``, ``late``, ``half_day``,
    ``on_leave``, ``avg_working_hours``.
    """
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])

    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.date >= start,
            Attendance.date <= end,
        )
    )
    records = result.scalars().all()

    return {
        "total_days": len(records),
        "present": sum(1 for r in records if r.status == AttendanceStatus.PRESENT),
        "absent": sum(1 for r in records if r.status == AttendanceStatus.ABSENT),
        "late": sum(1 for r in records if r.status == AttendanceStatus.LATE),
        "half_day": sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY),
        "on_leave": sum(1 for r in records if r.status == AttendanceStatus.ON_LEAVE),
        "avg_working_hours": float(
            sum(r.working_hours or 0 for r in records) / len(records)
        )
        if records
        else 0.0,
    }


# ── Team attendance helpers (shared between get / export) ─────────────────

def _team_joins(q):
    """Apply the standard Attendance → User → Department joins."""
    return (
        q.join(User, Attendance.employee_id == User.id)
        .outerjoin(Department, User.department_id == Department.id)
    )


def _apply_team_filters(q, department, date_from, date_to, status, search, current_user):
    """Apply WHERE clauses for team-attendance queries."""
    if current_user.role == Role.MANAGER:
        q = q.where(User.manager_id == current_user.id)
    if department:
        try:
            dept_uuid = _uuid.UUID(department)
            q = q.where(Department.id == dept_uuid)
        except ValueError:
            q = q.where(Department.name == department)
    if date_from:
        q = q.where(Attendance.date >= date_from)
    if date_to:
        q = q.where(Attendance.date <= date_to)
    if status:
        q = q.where(Attendance.status == AttendanceStatus(status))
    if search:
        term = f"%{search}%"
        q = q.where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
            )
        )
    return q


async def get_team_attendance(
    db: AsyncSession,
    current_user: User,
    filters: dict,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """Return paginated team attendance with summary.

    *filters* keys (all optional): ``department``, ``date_from``, ``date_to``,
    ``status``, ``search``.

    Returns a dict with ``records``, ``summary``, and ``total``.
    """
    department = filters.get("department")
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    status = filters.get("status")
    search = filters.get("search")
    fargs = (department, date_from, date_to, status, search, current_user)

    # Total count
    count_q = _apply_team_filters(
        _team_joins(select(func.count(Attendance.id))), *fargs
    )
    total = (await db.execute(count_q)).scalar() or 0

    # Summary: GROUP BY status
    sum_q = _apply_team_filters(
        _team_joins(select(Attendance.status, func.count().label("cnt"))),
        *fargs,
    ).group_by(Attendance.status)
    sum_rows = (await db.execute(sum_q)).all()
    status_counts = {row.status: row.cnt for row in sum_rows}

    summary = {
        "total": total,
        "present": status_counts.get(AttendanceStatus.PRESENT, 0),
        "absent": status_counts.get(AttendanceStatus.ABSENT, 0),
        "late": status_counts.get(AttendanceStatus.LATE, 0),
        "wfh": status_counts.get(AttendanceStatus.WFH, 0),
    }

    # Paginated records with employee info
    rec_q = _apply_team_filters(
        _team_joins(
            select(
                Attendance,
                (User.first_name + " " + User.last_name).label("employee_name"),
                User.avatar_url.label("employee_avatar"),
                func.coalesce(Department.name, "").label("department"),
            )
        ),
        *fargs,
    ).order_by(Attendance.date.desc()).offset(skip).limit(limit)

    rows = (await db.execute(rec_q)).all()

    records = []
    for row in rows:
        records.append(
            {
                "attendance": row[0],
                "employee_name": row.employee_name,
                "employee_avatar": row.employee_avatar,
                "department": row.department or "",
            }
        )

    return {"records": records, "summary": summary, "total": total}


async def export_team_attendance(
    db: AsyncSession,
    current_user: User,
    filters: dict,
) -> list[list[str]]:
    """Return CSV row data (including header) for a team-attendance export.

    *filters* keys (all optional): ``department``, ``date_from``, ``date_to``,
    ``status``, ``search``.
    """
    department = filters.get("department")
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    status = filters.get("status")
    search = filters.get("search")

    q = _apply_team_filters(
        _team_joins(
            select(
                Attendance,
                (User.first_name + " " + User.last_name).label("employee_name"),
                func.coalesce(Department.name, "").label("department"),
            )
        ),
        department,
        date_from,
        date_to,
        status,
        search,
        current_user,
    ).order_by(Attendance.date.desc())

    rows = (await db.execute(q)).all()

    csv_rows: list[list[str]] = [
        [
            "Date",
            "Employee",
            "Department",
            "Status",
            "Check In",
            "Check Out",
            "Working Hours",
            "Overtime",
        ]
    ]
    for row in rows:
        att = row[0]
        csv_rows.append(
            [
                str(att.date),
                row.employee_name,
                row.department or "",
                att.status.value if att.status else "",
                str(att.check_in or ""),
                str(att.check_out or ""),
                str(att.working_hours or ""),
                str(att.overtime_hours or ""),
            ]
        )

    return csv_rows
