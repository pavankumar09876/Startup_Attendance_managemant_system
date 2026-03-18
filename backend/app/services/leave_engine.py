"""
Leave calculation engine — sandwich rule, half-day, accrual, encashment, validation.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payroll import LeaveBalance
from app.models.settings import LeavePolicy, CompanySettings
from app.models.user import User


def _is_weekend(d: date, working_days: List[int]) -> bool:
    """Check if a date is a weekend based on company working_days (0=Mon)."""
    return d.weekday() not in working_days


def calculate_leave_days(
    start_date: date,
    end_date: date,
    is_half_day: bool,
    sandwich_rule: bool,
    holidays: List[date],
    working_days: List[int],
) -> float:
    """
    Calculate actual leave days considering half-day, weekends, holidays,
    and sandwich rule.
    """
    if is_half_day:
        return 0.5

    if start_date == end_date:
        return 1.0

    total = 0.0
    current = start_date
    while current <= end_date:
        is_wknd = _is_weekend(current, working_days)
        is_holiday = current in holidays

        if sandwich_rule:
            # Sandwich rule: weekends/holidays between leave days count as leave
            total += 1.0
        else:
            # Normal: skip weekends and holidays
            if not is_wknd and not is_holiday:
                total += 1.0
        current += timedelta(days=1)

    return total


def check_sandwich_rule(
    start_date: date,
    end_date: date,
    holidays: List[date],
    working_days: List[int],
) -> float:
    """
    Returns total days including sandwiched weekends/holidays.
    Sandwich rule: if leave is taken on both sides of a weekend/holiday,
    the weekend/holiday counts as leave.
    """
    return float((end_date - start_date).days + 1)


async def validate_leave_request(
    db: AsyncSession,
    employee_id,
    leave_type: str,
    start_date: date,
    end_date: date,
    is_half_day: bool,
    year: int,
) -> Tuple[bool, str, float]:
    """
    Validates a leave request against balance and policy rules.
    Returns (valid, message, adjusted_days).
    """
    # Find matching policy
    policy_res = await db.execute(
        select(LeavePolicy).where(LeavePolicy.name.ilike(f"%{leave_type}%"))
    )
    policy = policy_res.scalar_one_or_none()

    # Get company working days
    cs_res = await db.execute(select(CompanySettings).limit(1))
    cs = cs_res.scalar_one_or_none()
    working_days = cs.working_days if cs and cs.working_days else [0, 1, 2, 3, 4]

    # Calculate days
    sandwich = policy.sandwich_rule if policy else False
    days = calculate_leave_days(start_date, end_date, is_half_day, sandwich, [], working_days)

    # Check half-day allowed
    if is_half_day and policy and not policy.allow_half_day:
        return False, "Half-day leave is not allowed for this leave type.", days

    # Check probation eligibility
    if policy and policy.probation_days_before_eligible > 0:
        emp_res = await db.execute(select(User).where(User.id == employee_id))
        emp = emp_res.scalar_one_or_none()
        if emp and emp.date_of_joining:
            days_since_joining = (date.today() - emp.date_of_joining.date()).days
            if days_since_joining < policy.probation_days_before_eligible:
                return False, f"Not eligible yet. Must complete {policy.probation_days_before_eligible} days from joining.", days

    # Check balance
    balance_res = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.year == year,
            LeaveBalance.leave_type == leave_type,
        )
    )
    balance = balance_res.scalar_one_or_none()

    if balance:
        available = float(balance.total_days or 0) - float(balance.used_days or 0) - float(balance.pending_days or 0)
        if days > available:
            # Check negative balance
            if policy and policy.allow_negative_balance:
                max_neg = float(policy.max_negative_days or 0)
                if (available - days) < -max_neg:
                    return False, f"Exceeds maximum negative balance of {max_neg} days.", days
            else:
                return False, f"Insufficient balance. Available: {available:.1f} days, Requested: {days:.1f} days.", days

    return True, "OK", days


async def run_monthly_accrual(db: AsyncSession, year: int, month: int):
    """
    Accrue leave balances for all active employees based on policy accrual settings.
    Called by monthly cron on 1st of each month.
    """
    # Get all policies with monthly accrual
    policies_res = await db.execute(
        select(LeavePolicy).where(
            LeavePolicy.accrual_type == "monthly",
            LeavePolicy.monthly_accrual_amount.isnot(None),
        )
    )
    policies = policies_res.scalars().all()

    if not policies:
        return

    # Get all active employees
    employees_res = await db.execute(
        select(User).where(User.is_active == True)
    )
    employees = employees_res.scalars().all()

    for policy in policies:
        accrual = Decimal(str(policy.monthly_accrual_amount))
        for emp in employees:
            # Find or create balance
            bal_res = await db.execute(
                select(LeaveBalance).where(
                    LeaveBalance.employee_id == emp.id,
                    LeaveBalance.year == year,
                    LeaveBalance.leave_type == policy.name.lower(),
                )
            )
            balance = bal_res.scalar_one_or_none()
            if balance:
                balance.total_days = (balance.total_days or Decimal(0)) + accrual
            else:
                balance = LeaveBalance(
                    employee_id=emp.id,
                    year=year,
                    leave_type=policy.name.lower(),
                    total_days=accrual,
                    used_days=Decimal(0),
                    pending_days=Decimal(0),
                    carried_forward=Decimal(0),
                )
                db.add(balance)

    await db.commit()


def calculate_encashment(daily_salary: float, days: float) -> float:
    """Calculate leave encashment amount."""
    return round(daily_salary * days, 2)
