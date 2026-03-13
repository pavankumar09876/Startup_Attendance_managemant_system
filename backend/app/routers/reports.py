"""Reports router — /api/reports"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta
from typing import Optional, Any, Dict, List
import uuid

from app.database import get_db
from app.models.user import User, Role
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import Leave, LeaveStatus
from app.models.project import Project, Task, TaskStatus, project_members
from app.models.payroll import PayrollEntry
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/reports", tags=["Reports"])

REPORT_ROLES = (Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER)


@router.get("/attendance")
async def attendance_report(
    start_date:    date  = Query(default=None),
    end_date:      date  = Query(default=None),
    department_id: Optional[uuid.UUID] = None,
    employee_id:   Optional[uuid.UUID] = None,
    db:            AsyncSession = Depends(get_db),
    _:             User = Depends(require_roles(*REPORT_ROLES)),
) -> Dict[str, Any]:
    if not start_date:
        start_date = date.today() - timedelta(days=29)
    if not end_date:
        end_date = date.today()

    # Base query
    q = select(Attendance, User).join(User, Attendance.employee_id == User.id)
    if department_id:
        q = q.where(User.department_id == department_id)
    if employee_id:
        q = q.where(Attendance.employee_id == employee_id)
    q = q.where(Attendance.date >= start_date, Attendance.date <= end_date)

    result = await db.execute(q)
    rows   = result.all()

    # Daily trend
    trend_map: Dict[str, Dict[str, int]] = {}
    employee_map: Dict[str, Dict[str, Any]] = {}

    for att, user in rows:
        d = str(att.date)
        if d not in trend_map:
            trend_map[d] = {"present": 0, "absent": 0, "late": 0, "wfh": 0}
        st = att.status
        if st == AttendanceStatus.PRESENT:
            trend_map[d]["present"] += 1
        elif st == AttendanceStatus.ABSENT:
            trend_map[d]["absent"] += 1
        elif st == AttendanceStatus.LATE:
            trend_map[d]["late"] += 1

        uid = str(user.id)
        if uid not in employee_map:
            employee_map[uid] = {
                "employee_id": uid,
                "name": f"{user.first_name} {user.last_name}",
                "present": 0, "absent": 0, "late": 0, "wfh": 0,
                "total_days": 0,
            }
        employee_map[uid]["total_days"] += 1
        if st == AttendanceStatus.PRESENT:
            employee_map[uid]["present"] += 1
        elif st == AttendanceStatus.ABSENT:
            employee_map[uid]["absent"] += 1
        elif st == AttendanceStatus.LATE:
            employee_map[uid]["late"] += 1

    # Calculate attendance %
    for uid, emp in employee_map.items():
        td = emp["total_days"]
        emp["attendance_pct"] = round((emp["present"] + emp["late"]) / td * 100, 1) if td else 0

    return {
        "trend":     [{"date": k, **v} for k, v in sorted(trend_map.items())],
        "employees": list(employee_map.values()),
    }


@router.get("/projects")
async def project_report(
    project_id:  Optional[uuid.UUID] = None,
    db:          AsyncSession = Depends(get_db),
    _:           User = Depends(require_roles(*REPORT_ROLES)),
) -> Dict[str, Any]:
    q = select(Project)
    if project_id:
        q = q.where(Project.id == project_id)
    result  = await db.execute(q)
    projects = result.scalars().all()

    data = []
    for p in projects:
        task_result = await db.execute(
            select(func.count(Task.id), Task.status).where(
                Task.project_id == p.id
            ).group_by(Task.status)
        )
        task_counts = {row.status: row[0] for row in task_result.all()}
        total = sum(task_counts.values())
        done  = task_counts.get(TaskStatus.DONE, 0)

        data.append({
            "id":          str(p.id),
            "name":        p.name,
            "status":      p.status,
            "progress":    p.progress,
            "total_tasks": total,
            "done_tasks":  done,
            "start_date":  str(p.start_date) if p.start_date else None,
            "end_date":    str(p.end_date)   if p.end_date   else None,
        })

    return {"projects": data}


@router.get("/team")
async def team_report(
    db: AsyncSession = Depends(get_db),
    _:  User = Depends(require_roles(*REPORT_ROLES)),
) -> Dict[str, Any]:
    today = date.today()
    month_start = today.replace(day=1)

    emp_result = await db.execute(select(User).where(User.is_active == True))
    employees  = emp_result.scalars().all()

    rows = []
    for emp in employees:
        # Hours logged this month via attendance
        att_result = await db.execute(
            select(func.sum(Attendance.working_hours)).where(
                Attendance.employee_id == emp.id,
                Attendance.date >= month_start,
            )
        )
        hours_logged = float(att_result.scalar() or 0)

        # Tasks done this month (approximation)
        tasks_done = (await db.execute(
            select(func.count(Task.id)).where(
                Task.assignee_id == emp.id,
                Task.status == TaskStatus.DONE,
            )
        )).scalar() or 0

        working_days = (today - month_start).days + 1
        expected_hours = working_days * 8
        utilisation = round(hours_logged / expected_hours * 100, 1) if expected_hours else 0

        rows.append({
            "employee_id":  str(emp.id),
            "name":         f"{emp.first_name} {emp.last_name}",
            "designation":  emp.designation,
            "hours_logged": hours_logged,
            "expected_hours": expected_hours,
            "utilisation_pct": utilisation,
            "tasks_done":   tasks_done,
        })

    return {"employees": rows}


@router.get("/payroll")
async def payroll_report(
    db: AsyncSession = Depends(get_db),
    _:  User = Depends(require_roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR)),
) -> Dict[str, Any]:
    # Last 12 months
    today = date.today()
    months = []
    for i in range(11, -1, -1):
        d = date(today.year, today.month, 1) - timedelta(days=i * 30)
        months.append((d.year, d.month))

    data = []
    for year, month in months:
        result = await db.execute(
            select(
                func.count(PayrollEntry.id),
                func.sum(PayrollEntry.gross_salary),
                func.sum(PayrollEntry.total_deductions),
                func.sum(PayrollEntry.net_salary),
            ).where(
                PayrollEntry.year  == year,
                PayrollEntry.month == month,
            )
        )
        row = result.one()
        data.append({
            "year":        year,
            "month":       month,
            "employees":   row[0] or 0,
            "total_gross": float(row[1] or 0),
            "total_deductions": float(row[2] or 0),
            "total_net":   float(row[3] or 0),
        })

    return {"monthly": data}
