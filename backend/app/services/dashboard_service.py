"""
Dashboard service — pure business logic for dashboard aggregations.

All functions accept an AsyncSession and return plain dicts.
They never import FastAPI or raise HTTPException.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta, datetime as dt_cls, time as t_cls
from typing import Any, Dict

from app.models.user import User, Department, Role
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import Leave, LeaveStatus
from app.models.project import Project, Task, TaskStatus
from app.models.payroll import LeaveBalance
from app.models.sprint import Sprint, SprintStatus
from app.services.exceptions import ServiceError


async def get_admin_dashboard(db: AsyncSession) -> Dict[str, Any]:
    """Aggregate admin-level dashboard data."""
    today = date.today()
    month_start = today.replace(day=1)
    seven_days_ago = today - timedelta(days=6)

    # ── Counts ────────────────────────────────────────────────────────────────
    total_emp = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0

    present_today = (await db.execute(
        select(func.count(Attendance.id)).where(
            Attendance.date == today,
            Attendance.status.in_([
                AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WFH
            ]),
        )
    )).scalar() or 0

    pending_leaves = (await db.execute(
        select(func.count(Leave.id)).where(Leave.status == LeaveStatus.PENDING)
    )).scalar() or 0

    open_projects = (await db.execute(
        select(func.count(Project.id)).where(
            Project.status.in_(["planning", "in_progress"])
        )
    )).scalar() or 0

    attendance_pct = round(present_today / total_emp * 100, 1) if total_emp else 0.0

    # ── Attendance trend (last 7 days) ────────────────────────────────────────
    att_rows = (await db.execute(
        select(Attendance.date, Attendance.status).where(
            Attendance.date >= seven_days_ago,
            Attendance.date <= today,
        )
    )).all()

    trend: Dict[str, Dict[str, int]] = {}
    for row in att_rows:
        d = str(row.date)
        if d not in trend:
            trend[d] = {"present": 0, "absent": 0, "late": 0}
        if row.status in (AttendanceStatus.PRESENT, AttendanceStatus.WFH):
            trend[d]["present"] += 1
        elif row.status == AttendanceStatus.ABSENT:
            trend[d]["absent"] += 1
        elif row.status == AttendanceStatus.LATE:
            trend[d]["late"] += 1

    attendance_trend = [{"date": k, **v} for k, v in sorted(trend.items())]

    # ── Department headcount ──────────────────────────────────────────────────
    dept_rows = (await db.execute(
        select(Department.name, func.count(User.id).label("cnt"))
        .join(User, User.department_id == Department.id)
        .where(User.is_active == True)
        .group_by(Department.name)
        .order_by(func.count(User.id).desc())
    )).all()
    dept_headcount = [{"department": r.name, "count": r.cnt} for r in dept_rows]

    # ── Leave distribution this month ─────────────────────────────────────────
    leave_rows = (await db.execute(
        select(Leave.leave_type, func.count(Leave.id).label("cnt"))
        .where(
            Leave.created_at >= month_start,
            Leave.status.in_([LeaveStatus.PENDING, LeaveStatus.APPROVED]),
        )
        .group_by(Leave.leave_type)
    )).all()
    leave_distribution = [{"type": r.leave_type, "value": r.cnt} for r in leave_rows]

    # ── Absent today (single JOIN query) ──────────────────────────────────────
    abs_res = (await db.execute(
        select(User)
        .join(Attendance, Attendance.employee_id == User.id)
        .where(
            Attendance.date == today,
            Attendance.status == AttendanceStatus.ABSENT,
        )
        .limit(8)
    )).scalars().all()
    absent_users = [
        {
            "id":         str(u.id),
            "name":       f"{u.first_name} {u.last_name}",
            "department": "",
            "last_seen":  str(today),
        }
        for u in abs_res
    ]

    # ── Pending approvals ─────────────────────────────────────────────────────
    pending_items = (await db.execute(
        select(Leave).where(Leave.status == LeaveStatus.PENDING).limit(5)
    )).scalars().all()
    emp_ids = list({l.employee_id for l in pending_items})
    emp_map: Dict[str, User] = {}
    if emp_ids:
        emp_res = (await db.execute(select(User).where(User.id.in_(emp_ids)))).scalars().all()
        emp_map = {str(e.id): e for e in emp_res}

    pending_approvals = [
        {
            "id":       str(l.id),
            "employee": f"{emp_map[str(l.employee_id)].first_name} {emp_map[str(l.employee_id)].last_name}"
                        if str(l.employee_id) in emp_map else "Unknown",
            "type":     "Leave",
            "since":    str(l.created_at),
        }
        for l in pending_items
    ]

    # ── Recent activity ───────────────────────────────────────────────────────
    recent_att = (await db.execute(
        select(Attendance).where(
            Attendance.date >= seven_days_ago,
            Attendance.check_in.isnot(None),
        ).order_by(Attendance.created_at.desc()).limit(10)
    )).scalars().all()
    act_emp_ids = list({a.employee_id for a in recent_att})
    act_emp_map: Dict[str, User] = {}
    if act_emp_ids:
        act_res = (await db.execute(select(User).where(User.id.in_(act_emp_ids)))).scalars().all()
        act_emp_map = {str(e.id): e for e in act_res}

    recent_activity = [
        {
            "id":         str(a.id),
            "user":       f"{act_emp_map[str(a.employee_id)].first_name} {act_emp_map[str(a.employee_id)].last_name}"
                          if str(a.employee_id) in act_emp_map else "Unknown",
            "avatar":     act_emp_map[str(a.employee_id)].avatar_url if str(a.employee_id) in act_emp_map else None,
            "action":     f"checked in at {a.check_in}",
            "created_at": str(a.created_at),
        }
        for a in recent_att
    ]

    # ── Sprint velocity (last 6 completed sprints) ────────────────────────────
    completed_sprints = (await db.execute(
        select(Sprint)
        .where(Sprint.status == SprintStatus.COMPLETED)
        .order_by(Sprint.completed_at.desc())
        .limit(6)
    )).scalars().all()

    sprint_ids = [sp.id for sp in completed_sprints]
    velocity_rows = []
    if sprint_ids:
        velocity_rows = (await db.execute(
            select(Task.sprint_id, func.coalesce(func.sum(Task.story_points), 0).label("pts"))
            .where(Task.sprint_id.in_(sprint_ids), Task.status == TaskStatus.DONE)
            .group_by(Task.sprint_id)
        )).all()
    pts_map = {str(r.sprint_id): int(r.pts) for r in velocity_rows}

    sprint_velocity = [
        {
            "name":      sp.name,
            "completed": pts_map.get(str(sp.id), 0),
            "capacity":  sp.capacity or 0,
        }
        for sp in reversed(completed_sprints)
    ]

    return {
        "total_employees":    total_emp,
        "active_employees":   total_emp,
        "present_today":      present_today,
        "attendance_pct":     attendance_pct,
        "pending_leaves":     pending_leaves,
        "open_projects":      open_projects,
        "attendance_trend":   attendance_trend,
        "dept_headcount":     dept_headcount,
        "leave_distribution": leave_distribution,
        "absent_today":       absent_users,
        "pending_approvals":  pending_approvals,
        "recent_activity":    recent_activity,
        "sprint_velocity":    sprint_velocity,
    }


async def get_manager_dashboard(db: AsyncSession, manager_id) -> Dict[str, Any]:
    """Aggregate manager-scoped dashboard data."""
    today = date.today()

    # Get the IDs of direct reports
    direct_reports_res = await db.execute(
        select(User.id).where(User.manager_id == manager_id, User.is_active == True)
    )
    direct_report_ids = [r[0] for r in direct_reports_res.all()]

    pending_leaves = (await db.execute(
        select(func.count(Leave.id)).where(
            Leave.status == LeaveStatus.PENDING,
            Leave.employee_id.in_(direct_report_ids),
        )
    )).scalar() or 0

    my_projects = (await db.execute(
        select(Project).where(Project.manager_id == manager_id).limit(5)
    )).scalars().all()

    overdue = (await db.execute(
        select(func.count(Task.id)).where(
            Task.due_date < today,
            Task.status.notin_([TaskStatus.DONE]),
            Task.assignee_id.in_(direct_report_ids),
        )
    )).scalar() or 0

    team_size = len(direct_report_ids)

    return {
        "team_size":       team_size,
        "team_members":    team_size,
        "my_projects":     len(my_projects),
        "pending_leaves":  pending_leaves,
        "tasks_due_today": overdue,
        "budget_used_pct": 0,
        "project_progress": [
            {
                "id":       str(p.id),
                "name":     p.name,
                "status":   p.status,
                "progress": p.progress,
                "deadline": str(p.end_date) if p.end_date else None,
            }
            for p in my_projects
        ],
        "task_breakdown": [],
        "at_risk_tasks":  [],
    }


async def get_employee_dashboard(db: AsyncSession, employee_id) -> Dict[str, Any]:
    """Aggregate employee self-service dashboard data."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    year = today.year

    # ── Today's attendance ────────────────────────────────────────────────────
    today_att = (await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.date == today,
        )
    )).scalar_one_or_none()

    checked_in = bool(today_att and today_att.check_in)
    duration_min = None
    if checked_in and today_att and today_att.check_in:
        ci = today_att.check_in
        if not isinstance(ci, t_cls):
            ci = t_cls.fromisoformat(str(ci))
        start = dt_cls.combine(today, ci)
        duration_min = int((dt_cls.now() - start).total_seconds() / 60)

    check_in_status = {
        "checked_in":       checked_in,
        "check_in_time":    str(today_att.check_in) if today_att and today_att.check_in else None,
        "duration_minutes": duration_min,
    }

    # ── Month attendance % ────────────────────────────────────────────────────
    month_att = (await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.date >= month_start,
        )
    )).scalars().all()
    days_elapsed = (today - month_start).days + 1
    present_days = sum(
        1 for a in month_att
        if a.status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.WFH)
    )
    attendance_pct = round(present_days / days_elapsed * 100, 1) if days_elapsed else 0.0

    # ── Hours this week ───────────────────────────────────────────────────────
    week_att = (await db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee_id,
            Attendance.date >= week_start,
        )
    )).scalars().all()
    hours_this_week = float(sum(float(a.working_hours or 0) for a in week_att))

    # ── Open tasks ────────────────────────────────────────────────────────────
    open_tasks_cnt = (await db.execute(
        select(func.count(Task.id)).where(
            Task.assignee_id == employee_id,
            Task.status.notin_([TaskStatus.DONE]),
        )
    )).scalar() or 0

    my_tasks_rows = (await db.execute(
        select(Task, Project.name.label("pname"))
        .join(Project, Task.project_id == Project.id)
        .where(
            Task.assignee_id == employee_id,
            Task.status.notin_([TaskStatus.DONE]),
        )
        .order_by(Task.due_date.asc().nulls_last())
        .limit(5)
    )).all()
    my_tasks = [
        {
            "id":       str(row[0].id),
            "title":    row[0].title,
            "project":  row[1] or "",
            "status":   row[0].status.value,
            "priority": row[0].priority.value,
        }
        for row in my_tasks_rows
    ]

    # ── My recent leave requests ──────────────────────────────────────────────
    my_leaves_rows = (await db.execute(
        select(Leave)
        .where(Leave.employee_id == employee_id)
        .order_by(Leave.created_at.desc())
        .limit(3)
    )).scalars().all()
    my_leaves = [
        {
            "id":         str(l.id),
            "leave_type": l.leave_type,
            "start_date": str(l.start_date),
            "end_date":   str(l.end_date),
            "status":     l.status.value,
        }
        for l in my_leaves_rows
    ]

    # ── Leave balances ────────────────────────────────────────────────────────
    balances = (await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == year,
        )
    )).scalars().all()
    total_remaining = sum(
        float(b.total_days + b.carried_forward - b.used_days - b.pending_days)
        for b in balances
    )
    leave_balance = max(0, int(total_remaining))
    leave_consumption = [
        {
            "type":  b.leave_type,
            "used":  float(b.used_days),
            "total": float(b.total_days + b.carried_forward),
        }
        for b in balances
    ]

    # ── Next task deadline ────────────────────────────────────────────────────
    next_task_row = (await db.execute(
        select(Task, Project.name.label("pname"))
        .join(Project, Task.project_id == Project.id)
        .where(
            Task.assignee_id == employee_id,
            Task.due_date >= today,
            Task.status.notin_([TaskStatus.DONE]),
        )
        .order_by(Task.due_date.asc())
        .limit(1)
    )).first()

    next_deadline = None
    if next_task_row:
        t, pname = next_task_row[0], next_task_row[1]
        next_deadline = {"title": t.title, "due_date": str(t.due_date), "project": pname or ""}

    return {
        "attendance_pct":    attendance_pct,
        "leave_balance":     leave_balance,
        "open_tasks":        open_tasks_cnt,
        "hours_this_week":   hours_this_week,
        "check_in_status":   check_in_status,
        "my_tasks":          my_tasks,
        "my_leaves":         my_leaves,
        "leave_consumption": leave_consumption,
        "next_holiday":      None,
        "next_deadline":     next_deadline,
    }
