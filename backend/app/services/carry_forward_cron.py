"""
Carry-forward cron worker — creates next-year leave balances on Jan 1 at 00:05.

For each active employee × each LeavePolicy with `carry_forward=True`:
  - Reads current year's LeaveBalance
  - Calculates remaining = total_days + carried_forward - used_days - pending_days
  - Clamps to [0, max_carry_days]
  - Creates (or updates) next year's LeaveBalance with carry amount added to total_days

For policies without carry_forward, creates the next-year balance with just `days_per_year`.
Idempotent: skips employees that already have a balance row for the new year.
"""
from __future__ import annotations

import logging
from datetime import datetime

from decimal import Decimal
from sqlalchemy import select, and_

log = logging.getLogger(__name__)


async def run_carry_forward() -> None:
  try:
    from app.models.payroll import LeaveBalance
    from app.models.settings import LeavePolicy
    from app.models.user import User
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        current_year = datetime.now().year
        new_year = current_year + 1

        # Load all leave policies
        policy_res = await db.execute(select(LeavePolicy))
        policies = policy_res.scalars().all()
        if not policies:
            return

        # Load all active employees
        users_res = await db.execute(select(User).where(User.is_active == True))
        employees = users_res.scalars().all()
        if not employees:
            return

        # Load current year's balances keyed by (employee_id, leave_type)
        cur_res = await db.execute(
            select(LeaveBalance).where(LeaveBalance.year == current_year)
        )
        cur_balances: dict[tuple, LeaveBalance] = {
            (str(b.employee_id), b.leave_type): b
            for b in cur_res.scalars().all()
        }

        # Load existing new-year balances (to skip if already allocated)
        new_res = await db.execute(
            select(LeaveBalance).where(LeaveBalance.year == new_year)
        )
        already_allocated = {
            (str(b.employee_id), b.leave_type)
            for b in new_res.scalars().all()
        }

        created = 0
        for emp in employees:
            emp_id_str = str(emp.id)
            for policy in policies:
                key = (emp_id_str, policy.name)
                if key in already_allocated:
                    continue

                carry_amount = Decimal(0)
                if policy.carry_forward:
                    cur_bal = cur_balances.get(key)
                    if cur_bal:
                        remaining = (
                            cur_bal.total_days
                            + cur_bal.carried_forward
                            - cur_bal.used_days
                            - cur_bal.pending_days
                        )
                        carry_amount = max(
                            Decimal(0),
                            min(remaining, Decimal(str(policy.max_carry_days))),
                        )

                new_balance = LeaveBalance(
                    employee_id=emp.id,
                    year=new_year,
                    leave_type=policy.name,
                    total_days=Decimal(str(policy.days_per_year)),
                    used_days=Decimal(0),
                    pending_days=Decimal(0),
                    carried_forward=carry_amount,
                )
                db.add(new_balance)
                created += 1

        if created:
            await db.commit()
            log.info(
                "Carry-forward cron: created %d leave balance rows for year %d",
                created, new_year,
            )
  except Exception as e:
    log.error(f"Carry-forward cron failed: {e}", exc_info=True)
