from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, time
from decimal import Decimal
from typing import Optional
import uuid

from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.user import User, Role
from app.schemas.attendance import AttendanceCreate, AttendanceUpdate, AttendanceOut, AttendanceSummary
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/attendance", tags=["Attendance"])


def _calc_working_hours(check_in: time, check_out: time) -> Decimal:
    from datetime import datetime
    ci = datetime.combine(date.today(), check_in)
    co = datetime.combine(date.today(), check_out)
    diff = (co - ci).total_seconds() / 3600
    return Decimal(str(round(diff, 2)))


@router.get("/", response_model=list[AttendanceOut])
async def list_attendance(
    employee_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[AttendanceStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Attendance)
    # Employees can only see their own records
    if current_user.role == Role.EMPLOYEE:
        q = q.where(Attendance.employee_id == current_user.id)
    elif employee_id:
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == current_user.id,
            Attendance.date == today,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already checked in today")

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).time().replace(tzinfo=None)
    # Mark late if check-in is after 09:30
    status = AttendanceStatus.LATE if now.hour > 9 or (now.hour == 9 and now.minute > 30) else AttendanceStatus.PRESENT

    record = Attendance(
        employee_id=current_user.id,
        date=today,
        check_in=now,
        status=status,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/check-out", response_model=AttendanceOut)
async def check_out(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == current_user.id,
            Attendance.date == today,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="No check-in found for today")
    if record.check_out:
        raise HTTPException(status_code=400, detail="Already checked out")

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).time().replace(tzinfo=None)
    record.check_out = now
    record.working_hours = _calc_working_hours(record.check_in, now)
    std_hours = Decimal("8.0")
    if record.working_hours > std_hours:
        record.overtime_hours = record.working_hours - std_hours

    await db.commit()
    await db.refresh(record)
    return record


@router.post("/", response_model=AttendanceOut, status_code=201)
async def create_attendance(
    payload: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    record = Attendance(**payload.model_dump())
    if record.check_in and record.check_out:
        record.working_hours = _calc_working_hours(record.check_in, record.check_out)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.patch("/{attendance_id}", response_model=AttendanceOut)
async def update_attendance(
    attendance_id: uuid.UUID,
    payload: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
):
    result = await db.execute(select(Attendance).where(Attendance.id == attendance_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(record, field, value)

    if record.check_in and record.check_out:
        record.working_hours = _calc_working_hours(record.check_in, record.check_out)

    await db.commit()
    await db.refresh(record)
    return record


@router.get("/summary/{employee_id}", response_model=AttendanceSummary)
async def get_summary(
    employee_id: uuid.UUID,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from calendar import monthrange
    from datetime import date as dt
    start = dt(year, month, 1)
    end = dt(year, month, monthrange(year, month)[1])

    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.date >= start,
            Attendance.date <= end,
        )
    )
    records = result.scalars().all()

    summary = AttendanceSummary(
        total_days=len(records),
        present=sum(1 for r in records if r.status == AttendanceStatus.PRESENT),
        absent=sum(1 for r in records if r.status == AttendanceStatus.ABSENT),
        late=sum(1 for r in records if r.status == AttendanceStatus.LATE),
        half_day=sum(1 for r in records if r.status == AttendanceStatus.HALF_DAY),
        on_leave=sum(1 for r in records if r.status == AttendanceStatus.ON_LEAVE),
        avg_working_hours=float(
            sum(r.working_hours or 0 for r in records) / len(records)
        ) if records else 0.0,
    )
    return summary
