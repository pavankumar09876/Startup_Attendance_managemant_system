"""
Attendance penalty engine — calculates deductions based on late/absent/half-day records.

Called during payroll calculation to determine attendance-based deductions.
"""
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract

from app.models.attendance import Attendance, AttendanceStatus
from app.models.settings import AttendanceConfig


async def calculate_attendance_penalty(
    db: AsyncSession,
    employee_id,
    month: int,
    year: int,
    daily_salary: Decimal,
) -> dict:
    """
    Calculate attendance-based penalties for a given employee/month.

    Returns:
        {
            "late_days": int,
            "absent_days": int,
            "half_days": int,
            "late_deduction": Decimal,
            "absent_deduction": Decimal,
            "half_day_deduction": Decimal,
            "total_penalty": Decimal,
        }
    """
    # Load attendance config
    config = (await db.execute(select(AttendanceConfig).limit(1))).scalar_one_or_none()
    if not config:
        return _zero_result()

    # Count attendance statuses for the month
    records = (await db.execute(
        select(Attendance.status, func.count(Attendance.id))
        .where(
            Attendance.employee_id == employee_id,
            extract("month", Attendance.date) == month,
            extract("year", Attendance.date) == year,
        )
        .group_by(Attendance.status)
    )).all()

    status_counts = {row[0]: row[1] for row in records}
    late_days = status_counts.get(AttendanceStatus.LATE, 0)
    absent_days = status_counts.get(AttendanceStatus.ABSENT, 0)
    half_days = status_counts.get(AttendanceStatus.HALF_DAY, 0) if hasattr(AttendanceStatus, 'HALF_DAY') else 0

    late_deduction = Decimal("0")
    absent_deduction = Decimal("0")
    half_day_deduction = Decimal("0")

    # Late penalty
    if config.late_penalty_enabled and late_days > config.max_late_days_before_deduction:
        penalty_days = late_days - config.max_late_days_before_deduction
        if config.late_penalty_type == "percentage":
            late_deduction = daily_salary * Decimal(str(config.late_penalty_amount or 0)) / 100 * penalty_days
        else:  # fixed
            late_deduction = Decimal(str(config.late_penalty_amount or 0)) * penalty_days

    # Absent penalty
    if config.absent_penalty_enabled and absent_days > 0:
        multiplier = Decimal(str(config.absent_penalty_days or 1))
        absent_deduction = daily_salary * multiplier * absent_days

    # Half-day deduction
    if config.half_day_deduction_enabled and half_days > 0:
        half_day_deduction = Decimal(str(config.half_day_deduction_amount or 0)) * half_days

    total = late_deduction + absent_deduction + half_day_deduction

    return {
        "late_days": late_days,
        "absent_days": absent_days,
        "half_days": half_days,
        "late_deduction": late_deduction,
        "absent_deduction": absent_deduction,
        "half_day_deduction": half_day_deduction,
        "total_penalty": total,
    }


def _zero_result():
    return {
        "late_days": 0,
        "absent_days": 0,
        "half_days": 0,
        "late_deduction": Decimal("0"),
        "absent_deduction": Decimal("0"),
        "half_day_deduction": Decimal("0"),
        "total_penalty": Decimal("0"),
    }
