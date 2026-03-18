"""
Expense engine — policy validation, mileage calculation, currency conversion.
"""

from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.payroll import Expense, ExpensePolicy, ExpenseCategory
import json


async def get_applicable_policy(
    db: AsyncSession, category: ExpenseCategory
) -> ExpensePolicy | None:
    """Get the most specific active policy for a category."""
    # Try category-specific first
    result = await db.execute(
        select(ExpensePolicy).where(
            ExpensePolicy.category == category,
            ExpensePolicy.is_active == True,
        )
    )
    policy = result.scalar_one_or_none()
    if policy:
        return policy

    # Fall back to global policy (category=None)
    result = await db.execute(
        select(ExpensePolicy).where(
            ExpensePolicy.category == None,
            ExpensePolicy.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def validate_expense(
    db: AsyncSession, expense: Expense
) -> tuple[bool, str | None]:
    """Validate expense against applicable policy. Returns (valid, error_message)."""
    policy = await get_applicable_policy(db, expense.category)
    if not policy:
        return True, None

    # Check max amount
    amount_inr = expense.amount_inr or expense.amount
    if policy.max_amount and amount_inr > policy.max_amount:
        return False, f"Amount ₹{amount_inr} exceeds policy limit of ₹{policy.max_amount}"

    # Check receipt requirement
    if policy.requires_receipt and not expense.receipt_url:
        pass  # Allow submission without receipt, but flag it

    # Check allowed currencies
    if policy.allowed_currencies:
        allowed = json.loads(policy.allowed_currencies)
        if expense.currency not in allowed:
            return False, f"Currency {expense.currency} not allowed. Allowed: {', '.join(allowed)}"

    return True, None


def calculate_mileage(km: Decimal, rate_per_km: Decimal) -> Decimal:
    """Calculate mileage reimbursement amount."""
    return round(km * rate_per_km, 2)


def convert_currency(amount: Decimal, exchange_rate: Decimal) -> Decimal:
    """Convert foreign currency amount to INR."""
    return round(amount * exchange_rate, 2)


async def should_auto_approve(
    db: AsyncSession, expense: Expense
) -> bool:
    """Check if expense qualifies for auto-approval."""
    policy = await get_applicable_policy(db, expense.category)
    if not policy:
        return False

    if not policy.requires_approval:
        return True

    amount_inr = expense.amount_inr or expense.amount
    if policy.auto_approve_below and amount_inr <= policy.auto_approve_below:
        return True

    return False
