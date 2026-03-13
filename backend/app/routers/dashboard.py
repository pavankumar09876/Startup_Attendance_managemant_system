"""Dashboard router — /api/dashboard"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta
from typing import Any, Dict

from app.database import get_db
from app.models.user import User, Role
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import Leave, LeaveStatus
from app.models.project import Project, Task, TaskStatus
from app.models.payroll import PayrollEntry, PayrollStatus
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/admin")
async def admin_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    today = date.today()
    month_start = today.replace(day=1)

    # Total employees
    emp_count = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar()

    # Present today
    present_today = (await db.execute(
        select(func.count(Attendance.id)).where(
            Attendance.date == today,
            Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE])
        )
    )).scalar()

    # Pending leaves
    pending_leaves = (await db.execute(
        select(func.count(Leave.id)).where(Leave.status == LeaveStatus.PENDING)
    )).scalar()

    # Active projects
    active_projects = (await db.execute(
        select(func.count(Project.id)).where(
            Project.status.in_(["planning", "in_progress"])
        )
    )).scalar()

    # Open tasks
    open_tasks = (await db.execute(
        select(func.count(Task.id)).where(
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW])
        )
    )).scalar()

    # Attendance this month (last 7 days trend)
    seven_days_ago = today - timedelta(days=6)
    att_result = await db.execute(
        select(Attendance.date, Attendance.status).where(
            Attendance.date >= seven_days_ago,
            Attendance.date <= today,
        )
    )
    att_rows = att_result.all()

    trend: Dict[str, Dict[str, int]] = {}
    for row in att_rows:
        d = str(row.date)
        if d not in trend:
            trend[d] = {"present": 0, "absent": 0, "late": 0}
        if row.status in (AttendanceStatus.PRESENT,):
            trend[d]["present"] += 1
        elif row.status == AttendanceStatus.ABSENT:
            trend[d]["absent"] += 1
        elif row.status == AttendanceStatus.LATE:
            trend[d]["late"] += 1

    attendance_trend = [
        {"date": k, **v}
        for k, v in sorted(trend.items())
    ]

    return {
        "total_employees":  emp_count,
        "present_today":    present_today,
        "pending_leaves":   pending_leaves,
        "active_projects":  active_projects,
        "open_tasks":       open_tasks,
        "attendance_trend": attendance_trend,
    }


@router.get("/manager")
async def manager_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    today = date.today()

    # Team size
    team_size = (await db.execute(
        select(func.count(User.id)).where(
            User.is_active == True,
            User.role == Role.EMPLOYEE,
        )
    )).scalar()

    # Pending leave approvals
    pending_leaves = (await db.execute(
        select(func.count(Leave.id)).where(Leave.status == LeaveStatus.PENDING)
    )).scalar()

    # My projects (manager)
    my_projects = (await db.execute(
        select(Project).where(Project.manager_id == current_user.id).limit(5)
    )).scalars().all()

    # My overdue tasks
    overdue = (await db.execute(
        select(func.count(Task.id)).where(
            Task.due_date < today,
            Task.status.notin_([TaskStatus.DONE]),
        )
    )).scalar()

    return {
        "team_size":       team_size,
        "pending_leaves":  pending_leaves,
        "overdue_tasks":   overdue,
        "my_projects":     [{"id": str(p.id), "name": p.name, "status": p.status, "progress": p.progress} for p in my_projects],
    }


@router.get("/employee")
async def employee_dashboard(
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    today = date.today()
    month_start = today.replace(day=1)

    # Today's attendance
    att_result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == current_user.id,
            Attendance.date == today,
        )
    )
    today_att = att_result.scalar_one_or_none()

    # This month attendance stats
    month_att = (await db.execute(
        select(Attendance).where(
            Attendance.employee_id == current_user.id,
            Attendance.date >= month_start,
        )
    )).scalars().all()

    # My pending tasks
    my_tasks = (await db.execute(
        select(Task).where(
            Task.assignee_id == current_user.id,
            Task.status.notin_([TaskStatus.DONE]),
        ).limit(5)
    )).scalars().all()

    # My leave requests
    my_leaves = (await db.execute(
        select(Leave).where(
            Leave.employee_id == current_user.id,
            Leave.status == LeaveStatus.PENDING,
        ).limit(3)
    )).scalars().all()

    return {
        "today_attendance": {
            "checked_in":  bool(today_att and today_att.check_in),
            "checked_out": bool(today_att and today_att.check_out),
            "status":      today_att.status if today_att else None,
            "check_in":    str(today_att.check_in) if today_att and today_att.check_in else None,
        },
        "month_stats": {
            "present": sum(1 for a in month_att if a.status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE)),
            "absent":  sum(1 for a in month_att if a.status == AttendanceStatus.ABSENT),
            "late":    sum(1 for a in month_att if a.status == AttendanceStatus.LATE),
        },
        "pending_tasks":  [{"id": str(t.id), "title": t.title, "priority": t.priority, "due_date": str(t.due_date) if t.due_date else None} for t in my_tasks],
        "pending_leaves": [{"id": str(l.id), "leave_type": l.leave_type, "start_date": str(l.start_date), "total_days": l.total_days} for l in my_leaves],
    }
