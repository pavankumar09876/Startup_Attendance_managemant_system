from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import Optional
import uuid
import io
import csv

from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.user import User, Role
from app.schemas.attendance import (
    AttendanceCreate, AttendanceUpdate, AttendanceOut, AttendanceSummary,
    TeamAttendanceRecord, TeamAttendanceSummary, PaginatedTeamAttendance,
)
from app.utils.dependencies import get_current_user, require_roles, require_permission
from app.utils.scoping import scope_query
from app.services.exceptions import ServiceError
from app.services.attendance_service import (
    calc_working_hours,
    check_in as svc_check_in,
    check_out as svc_check_out,
    check_in_geo as svc_check_in_geo,
    start_break as svc_start_break,
    end_break as svc_end_break,
    get_attendance_summary as svc_get_attendance_summary,
    get_team_attendance as svc_get_team_attendance,
    export_team_attendance as svc_export_team_attendance,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


# ---------------------------------------------------------------------------
# Thin helper: convert ServiceError → HTTPException
# ---------------------------------------------------------------------------

def _handle_service_error(e: ServiceError):
    raise HTTPException(status_code=e.code, detail=e.message)


# ---------------------------------------------------------------------------
# List / CRUD endpoints (kept in router — thin DB queries + schema mapping)
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[AttendanceOut])
async def list_attendance(
    employee_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[AttendanceStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("attendance:view_own")),
):
    q = scope_query(select(Attendance), current_user, employee_id_col=Attendance.employee_id)
    # If a specific employee_id is requested and user has access
    if employee_id and current_user.role not in (Role.EMPLOYEE,):
        q = q.where(Attendance.employee_id == employee_id)

    if start_date:
        q = q.where(Attendance.date >= start_date)
    if end_date:
        q = q.where(Attendance.date <= end_date)
    if status:
        q = q.where(Attendance.status == status)

    q = q.order_by(Attendance.date.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/check-in", response_model=AttendanceOut)
async def check_in(
    wfh: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await svc_check_in(db, current_user, wfh=wfh)
    except ServiceError as e:
        _handle_service_error(e)


@router.post("/check-out", response_model=AttendanceOut)
async def check_out(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await svc_check_out(db, current_user)
    except ServiceError as e:
        _handle_service_error(e)


@router.post("/", response_model=AttendanceOut, status_code=201)
async def create_attendance(
    payload: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("attendance:create")),
):
    record = Attendance(**payload.model_dump())
    if record.check_in and record.check_out:
        record.working_hours = calc_working_hours(record.check_in, record.check_out)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{attendance_id}", response_model=AttendanceOut)
async def update_attendance(
    attendance_id: uuid.UUID,
    payload: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("attendance:update")),
):
    result = await db.execute(select(Attendance).where(Attendance.id == attendance_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(record, field, value)

    if record.check_in and record.check_out:
        record.working_hours = calc_working_hours(record.check_in, record.check_out)

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/summary/{employee_id}", response_model=AttendanceSummary)
async def get_summary(
    employee_id: uuid.UUID,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ownership / scoping check
    if employee_id != current_user.id:
        if current_user.role == Role.EMPLOYEE:
            raise HTTPException(status_code=403, detail="Can only view your own attendance summary")
        if current_user.role == Role.MANAGER:
            # Managers can view their direct reports
            emp_result = await db.execute(select(User).where(User.id == employee_id))
            emp = emp_result.scalar_one_or_none()
            if not emp or emp.manager_id != current_user.id:
                raise HTTPException(status_code=403, detail="Can only view your team's attendance")
    try:
        data = await svc_get_attendance_summary(db, employee_id, month, year)
    except ServiceError as e:
        _handle_service_error(e)
    return AttendanceSummary(**data)


# ── Team attendance (managers / admins) ───────────────────────────────────────

@router.get("/team", response_model=PaginatedTeamAttendance)
async def get_team_attendance(
    department: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("attendance:view_team", "attendance:view_all")),
):
    filters = {
        "department": department,
        "date_from": date_from,
        "date_to": date_to,
        "status": status,
        "search": search,
    }
    try:
        data = await svc_get_team_attendance(db, current_user, filters, skip, limit)
    except ServiceError as e:
        _handle_service_error(e)

    summary = TeamAttendanceSummary(**data["summary"])

    records = []
    for item in data["records"]:
        att = item["attendance"]
        rec = TeamAttendanceRecord.model_validate(att)
        rec.employee_name = item["employee_name"]
        rec.employee_avatar = item["employee_avatar"]
        rec.department = item["department"]
        records.append(rec)

    return PaginatedTeamAttendance(records=records, summary=summary, total=data["total"])


@router.get("/export")
async def export_team_attendance(
    department: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("attendance:export")),
):
    filters = {
        "department": department,
        "date_from": date_from,
        "date_to": date_to,
        "status": status,
        "search": search,
    }
    try:
        csv_rows = await svc_export_team_attendance(db, current_user, filters)
    except ServiceError as e:
        _handle_service_error(e)

    output = io.StringIO()
    writer = csv.writer(output)
    for row in csv_rows:
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=team_attendance.csv"},
    )


# ── Geo-fenced + selfie check-in ─────────────────────────────────────────────

@router.post('/check-in/geo', response_model=AttendanceOut)
async def check_in_geo(
    latitude:   float = Form(...),
    longitude:  float = Form(...),
    selfie:     Optional[UploadFile] = None,
    db:         AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check in with geo-coordinates and optional selfie."""
    try:
        return await svc_check_in_geo(db, current_user, latitude, longitude, selfie_file=selfie)
    except ServiceError as e:
        _handle_service_error(e)


# ── Break tracking ─────────────────────────────────────────────────────────────

@router.post("/break-start", response_model=AttendanceOut)
async def break_start(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start a break for the current employee."""
    try:
        return await svc_start_break(db, current_user)
    except ServiceError as e:
        _handle_service_error(e)


@router.post("/break-end", response_model=AttendanceOut)
async def break_end(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End the current break and accumulate break time."""
    try:
        return await svc_end_break(db, current_user)
    except ServiceError as e:
        _handle_service_error(e)
