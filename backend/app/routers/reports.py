"""Reports router — /api/reports"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import date, timedelta
from typing import Optional, Any, Dict, List
import uuid

from app.database import get_db
from app.models.user import User, Role
from app.models.attendance import Attendance, AttendanceStatus
from app.models.leave import Leave, LeaveStatus
from app.models.project import Project, Task, TaskStatus, project_members
from app.models.payroll import PayrollEntry, Expense, ExpenseStatus
from app.models.user import Department
from app.utils.dependencies import get_current_user, require_roles, require_permission
from app.utils.scoping import scope_query, scope_users
from decimal import Decimal
from sqlalchemy import extract

router = APIRouter(prefix="/reports", tags=["Reports"])


def _visible_employee_ids_subq(current_user: User):
    """Return a subquery of employee IDs the current user can see."""
    if current_user.role in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        return None  # no filter needed
    if current_user.role == Role.MANAGER:
        return select(User.id).where(
            or_(User.manager_id == current_user.id, User.id == current_user.id)
        )
    # EMPLOYEE — self only
    return select(User.id).where(User.id == current_user.id)


@router.get("/attendance")
async def attendance_report(
    start_date:    date  = Query(default=None),
    end_date:      date  = Query(default=None),
    department_id: Optional[uuid.UUID] = None,
    employee_id:   Optional[uuid.UUID] = None,
    db:            AsyncSession = Depends(get_db),
    current_user:  User = Depends(require_permission("report:attendance")),
) -> Dict[str, Any]:
    if not start_date:
        start_date = date.today() - timedelta(days=29)
    if not end_date:
        end_date = date.today()

    # Base query — scoped to visible employees
    q = select(Attendance, User).join(User, Attendance.employee_id == User.id)
    vis_subq = _visible_employee_ids_subq(current_user)
    if vis_subq is not None:
        q = q.where(Attendance.employee_id.in_(vis_subq))
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
    current_user: User = Depends(require_permission("report:project")),
) -> Dict[str, Any]:
    q = select(Project)
    if project_id:
        q = q.where(Project.id == project_id)
    # Managers/employees only see projects they manage or are a member of
    if current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        q = q.where(
            or_(
                Project.manager_id == current_user.id,
                Project.id.in_(
                    select(project_members.c.project_id).where(
                        project_members.c.user_id == current_user.id
                    )
                ),
            )
        )
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
    current_user: User = Depends(require_permission("report:team")),
) -> Dict[str, Any]:
    today = date.today()
    month_start = today.replace(day=1)

    from app.utils.scoping import scope_users
    emp_q = scope_users(select(User).where(User.is_active == True), current_user)
    emp_result = await db.execute(emp_q)
    employees  = emp_result.scalars().all()

    # Aggregate hours per employee in one query
    hours_result = await db.execute(
        select(Attendance.employee_id, func.sum(Attendance.working_hours))
        .where(Attendance.date >= month_start)
        .group_by(Attendance.employee_id)
    )
    hours_map = dict(hours_result.all())

    # Aggregate tasks done per employee in one query
    tasks_result = await db.execute(
        select(Task.assignee_id, func.count(Task.id))
        .where(Task.status == TaskStatus.DONE)
        .group_by(Task.assignee_id)
    )
    tasks_map = dict(tasks_result.all())

    working_days = (today - month_start).days + 1
    expected_hours = working_days * 8

    rows = []
    for emp in employees:
        hours_logged = float(hours_map.get(emp.id, 0) or 0)
        tasks_done = tasks_map.get(emp.id, 0)
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
    current_user: User = Depends(require_permission("report:financial")),
) -> Dict[str, Any]:
    # Financial reports restricted to admin/HR roles only
    if current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        raise HTTPException(403, "Financial reports are restricted to Admin/HR")
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


@router.get("/workforce-demographics")
async def workforce_demographics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:workforce")),
) -> Dict[str, Any]:
    """Workforce demographics: department breakdown, role distribution."""
    total = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0

    # By department
    dept_result = await db.execute(
        select(Department.name, func.count(User.id))
        .join(User, User.department_id == Department.id)
        .where(User.is_active == True)
        .group_by(Department.name)
    )
    by_department = {name: count for name, count in dept_result.all()}

    # By role
    role_result = await db.execute(
        select(User.role, func.count(User.id))
        .where(User.is_active == True)
        .group_by(User.role)
    )
    by_role = {role.value: count for role, count in role_result.all()}

    # By designation (top 10)
    desig_result = await db.execute(
        select(User.designation, func.count(User.id))
        .where(User.is_active == True, User.designation != None)
        .group_by(User.designation)
        .order_by(func.count(User.id).desc())
        .limit(10)
    )
    by_designation = {d: c for d, c in desig_result.all()}

    return {
        "total_active": total,
        "by_department": by_department,
        "by_role": by_role,
        "by_designation": by_designation,
    }


@router.get("/headcount-trend")
async def headcount_trend(
    months: int = Query(12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("report:workforce")),
) -> List:
    """Monthly headcount trend based on date_of_joining."""
    today = date.today()

    # Build list of month boundaries
    month_boundaries = []
    for i in range(months - 1, -1, -1):
        target = today.replace(day=1) - timedelta(days=i * 30)
        month_boundaries.append(target.replace(day=1))

    # Single query: joiners grouped by year-month
    joiners_result = await db.execute(
        select(
            extract('year', User.date_of_joining).label('y'),
            extract('month', User.date_of_joining).label('m'),
            func.count(User.id)
        )
        .where(User.date_of_joining.isnot(None))
        .group_by('y', 'm')
    )
    joiners_map = {(int(r[0]), int(r[1])): r[2] for r in joiners_result.all()}

    # Single query: total active users count (baseline)
    total_active = (await db.execute(
        select(func.count(User.id)).where(
            User.is_active == True,
            User.date_of_joining.isnot(None),
        )
    )).scalar() or 0

    # Single query: total joiners after earliest month to compute running headcount
    earliest = month_boundaries[0] if month_boundaries else today
    users_before_earliest = (await db.execute(
        select(func.count(User.id)).where(
            User.is_active == True,
            User.date_of_joining <= earliest,
        )
    )).scalar() or 0

    trends = []
    running_count = users_before_earliest
    for idx, month_start in enumerate(month_boundaries):
        next_month = (month_start + timedelta(days=32)).replace(day=1)
        new_joiners = joiners_map.get((month_start.year, month_start.month), 0)
        if idx > 0:
            running_count += new_joiners

        trends.append({
            "month": month_start.strftime("%Y-%m"),
            "headcount": running_count,
            "new_joiners": new_joiners,
        })

    return trends


@router.get("/leave-analytics")
async def leave_analytics(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("report:attendance")),
) -> Dict[str, Any]:
    """Leave analytics: by type, approval rate, monthly trends."""
    if not year:
        year = date.today().year

    # Scope filter
    vis_subq = _visible_employee_ids_subq(current_user)
    scope_filters = [extract("year", Leave.start_date) == year]
    if vis_subq is not None:
        scope_filters.append(Leave.employee_id.in_(vis_subq))

    # By type — single aggregate query
    type_result = await db.execute(
        select(Leave.leave_type, func.sum(Leave.total_days))
        .where(*scope_filters)
        .group_by(Leave.leave_type)
    )
    by_type: Dict[str, float] = {}
    for row in type_result.all():
        lt = row[0].value if hasattr(row[0], "value") else str(row[0])
        by_type[lt] = float(row[1] or 0)

    # By status — single aggregate query
    status_result = await db.execute(
        select(Leave.status, func.count(Leave.id))
        .where(*scope_filters)
        .group_by(Leave.status)
    )
    status_map = {row[0]: row[1] for row in status_result.all()}
    approved = status_map.get(LeaveStatus.APPROVED, 0)
    rejected = status_map.get(LeaveStatus.REJECTED, 0)
    pending = status_map.get(LeaveStatus.PENDING, 0)

    # Monthly trend — single aggregate query
    monthly_result = await db.execute(
        select(
            extract("month", Leave.start_date).label("m"),
            func.count(Leave.id)
        )
        .where(*scope_filters)
        .group_by("m")
    )
    monthly: Dict[str, int] = {}
    for row in monthly_result.all():
        month_key = f"{year}-{int(row[0]):02d}"
        monthly[month_key] = row[1]

    total = approved + rejected + pending
    return {
        "year": year,
        "total_requests": total,
        "approved": approved,
        "rejected": rejected,
        "pending": pending,
        "approval_rate": round(approved / total * 100, 1) if total > 0 else 0,
        "by_type": by_type,
        "monthly_trend": monthly,
    }


@router.get("/expense-analytics")
async def expense_analytics(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("report:financial")),
) -> Dict[str, Any]:
    """Expense analytics: total spend, by category, monthly trends."""
    if current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        raise HTTPException(403, "Financial reports are restricted to Admin/HR")
    if not year:
        year = date.today().year

    expenses = (await db.execute(
        select(Expense).where(extract("year", Expense.date) == year)
    )).scalars().all()

    total = Decimal("0")
    approved_total = Decimal("0")
    by_category: Dict[str, float] = {}
    monthly: Dict[str, float] = {}

    for e in expenses:
        amt = e.amount_inr or e.amount
        total += amt
        if e.status == ExpenseStatus.APPROVED:
            approved_total += amt
        cat = e.category.value if e.category else "other"
        by_category[cat] = by_category.get(cat, 0) + float(amt)
        m = e.date.strftime("%Y-%m")
        monthly[m] = monthly.get(m, 0) + float(amt)

    return {
        "year": year,
        "total_submitted": float(total),
        "total_approved": float(approved_total),
        "count": len(expenses),
        "by_category": by_category,
        "monthly_trend": monthly,
    }


@router.get("/payroll-analytics")
async def payroll_analytics(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("report:financial")),
) -> Dict[str, Any]:
    """Payroll analytics: CTC trends, deduction breakdown."""
    if current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        raise HTTPException(403, "Financial reports are restricted to Admin/HR")
    if not year:
        year = date.today().year

    entries = (await db.execute(
        select(PayrollEntry).where(PayrollEntry.year == year)
    )).scalars().all()

    monthly_cost: Dict[str, Dict[str, float]] = {}
    total_gross = total_net = total_deductions = Decimal("0")
    epf_total = esi_total = tds_total = pt_total = Decimal("0")

    for e in entries:
        total_gross += e.gross_salary
        total_net += e.net_salary
        total_deductions += e.total_deductions
        epf_total += e.pf_deduction
        esi_total += e.esi_deduction
        tds_total += e.tds_deduction
        pt_total += (e.professional_tax or Decimal("0"))

        m = f"{year}-{e.month:02d}"
        if m not in monthly_cost:
            monthly_cost[m] = {"gross": 0, "net": 0, "deductions": 0}
        monthly_cost[m]["gross"] += float(e.gross_salary)
        monthly_cost[m]["net"] += float(e.net_salary)
        monthly_cost[m]["deductions"] += float(e.total_deductions)

    return {
        "year": year,
        "total_gross": float(total_gross),
        "total_net": float(total_net),
        "total_deductions": float(total_deductions),
        "deduction_breakdown": {
            "epf": float(epf_total),
            "esi": float(esi_total),
            "tds": float(tds_total),
            "professional_tax": float(pt_total),
        },
        "monthly_trend": monthly_cost,
    }


@router.get("/task-analytics")
async def task_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("report:project")),
) -> Dict[str, Any]:
    """Task analytics: completion rate, overdue, by status/priority."""
    # Scope: admin/HR see all; others see only tasks in their projects
    q = select(Task)
    if current_user.role not in (Role.SUPER_ADMIN, Role.ADMIN, Role.HR):
        my_project_ids = select(project_members.c.project_id).where(
            project_members.c.user_id == current_user.id
        )
        managed_project_ids = select(Project.id).where(Project.manager_id == current_user.id)
        q = q.where(
            or_(
                Task.project_id.in_(my_project_ids),
                Task.project_id.in_(managed_project_ids),
                Task.assignee_id == current_user.id,
            )
        )
    tasks = (await db.execute(q)).scalars().all()

    by_status: Dict[str, int] = {}
    by_priority: Dict[str, int] = {}
    overdue = 0
    today = date.today()

    for t in tasks:
        s = t.status.value
        p = t.priority.value
        by_status[s] = by_status.get(s, 0) + 1
        by_priority[p] = by_priority.get(p, 0) + 1
        if t.due_date and t.due_date < today and t.status != TaskStatus.DONE:
            overdue += 1

    total = len(tasks)
    done = by_status.get("done", 0)

    return {
        "total": total,
        "completed": done,
        "overdue": overdue,
        "completion_rate": round(done / total * 100, 1) if total > 0 else 0,
        "by_status": by_status,
        "by_priority": by_priority,
    }
