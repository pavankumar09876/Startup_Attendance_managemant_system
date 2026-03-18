"""Expenses router — /api/expenses"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal
import uuid
import os

from app.database import get_db
from app.models.payroll import Expense, ExpenseStatus, ExpensePolicy, ExpenseCategory, ExpenseApproval, ExpenseApprovalStage
from app.models.user import User, Role
from app.schemas.payroll import (
    ExpenseCreate, ExpenseUpdate, ExpenseOut,
    ExpensePolicyCreate, ExpensePolicyOut, ExpenseSummaryOut,
)
from app.utils.dependencies import get_current_user, require_roles, require_permission
from app.utils.scoping import scope_query
from app.utils.audit import log_action
from app.routers.notifications_router import push_notification
from app.models.notification import NotificationType
from app.services.expense_engine import (
    validate_expense, calculate_mileage, convert_currency, should_auto_approve,
    get_applicable_policy,
)

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("/", response_model=list[ExpenseOut])
async def list_expenses(
    employee_id:   Optional[uuid.UUID] = None,
    status:        Optional[ExpenseStatus] = None,
    category:      Optional[ExpenseCategory] = None,
    skip:          int = Query(0, ge=0),
    limit:         int = Query(50, ge=1, le=200),
    db:            AsyncSession = Depends(get_db),
    current_user:  User = Depends(require_permission("expense:view_own", "expense:view_all")),
):
    q = scope_query(select(Expense), current_user, employee_id_col=Expense.employee_id)
    if employee_id and current_user.role not in (Role.EMPLOYEE,):
        q = q.where(Expense.employee_id == employee_id)
    if status:
        q = q.where(Expense.status == status)
    if category:
        q = q.where(Expense.category == category)
    q = q.order_by(Expense.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=ExpenseOut, status_code=201)
async def submit_expense(
    payload:      ExpenseCreate,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()

    # Calculate amount_inr for foreign currency
    amount_inr = convert_currency(data["amount"], data.get("exchange_rate", Decimal("1")))
    data["amount_inr"] = amount_inr

    # Mileage calculation
    if data.get("mileage_km"):
        policy = await get_applicable_policy(db, payload.category)
        rate = policy.mileage_rate_per_km if policy else Decimal("8")
        data["mileage_rate"] = rate
        data["amount"] = calculate_mileage(data["mileage_km"], rate)
        data["amount_inr"] = data["amount"]

    expense = Expense(**data, employee_id=current_user.id)

    # Policy validation
    valid, error = await validate_expense(db, expense)
    if not valid:
        raise HTTPException(400, error)

    # Auto-approve if below threshold
    if await should_auto_approve(db, expense):
        expense.status = ExpenseStatus.APPROVED
        expense.reviewed_at = datetime.now(timezone.utc)

    db.add(expense)
    await db.flush()  # get expense.id before creating approval stages

    # Multi-stage approval: determine levels based on amount
    if expense.status == ExpenseStatus.PENDING:
        amount = float(expense.amount_inr or expense.amount)
        if amount >= 50000:
            levels = 3   # manager → finance → CFO/admin
        elif amount >= 10000:
            levels = 2   # manager → finance
        else:
            levels = 1   # manager only
        expense.max_approval_level = levels
        expense.current_approval_level = 0
        for lvl in range(1, levels + 1):
            db.add(ExpenseApproval(expense_id=expense.id, level=lvl))

    await db.commit()
    await db.refresh(expense)
    return expense


@router.get("/summary", response_model=ExpenseSummaryOut)
async def expense_summary(
    year:  int = Query(default=None),
    month: int = Query(default=None),
    db:    AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get expense summary for current user (or all for managers)."""
    # Build base filter
    filters = []
    if current_user.role == Role.EMPLOYEE:
        filters.append(Expense.employee_id == current_user.id)
    if year:
        filters.append(sqlfunc.extract("year", Expense.date) == year)
    if month:
        filters.append(sqlfunc.extract("month", Expense.date) == month)

    base_where = select(Expense).where(*filters) if filters else select(Expense)

    # Aggregate by status in one query
    status_q = (
        select(
            Expense.status,
            sqlfunc.count(Expense.id),
            sqlfunc.sum(sqlfunc.coalesce(Expense.amount_inr, Expense.amount)),
        )
        .where(*filters)
        .group_by(Expense.status)
    ) if filters else (
        select(
            Expense.status,
            sqlfunc.count(Expense.id),
            sqlfunc.sum(sqlfunc.coalesce(Expense.amount_inr, Expense.amount)),
        )
        .group_by(Expense.status)
    )
    status_result = await db.execute(status_q)
    status_rows = status_result.all()

    total_submitted = total_approved = total_pending = total_rejected = Decimal("0")
    count_submitted = count_approved = count_pending = count_rejected = 0
    for s, cnt, amt in status_rows:
        amt = amt or Decimal("0")
        count_submitted += cnt
        total_submitted += amt
        if s == ExpenseStatus.APPROVED:
            total_approved, count_approved = amt, cnt
        elif s == ExpenseStatus.PENDING:
            total_pending, count_pending = amt, cnt
        elif s == ExpenseStatus.REJECTED:
            total_rejected, count_rejected = amt, cnt

    # Aggregate by category in one query
    cat_q = (
        select(
            Expense.category,
            sqlfunc.sum(sqlfunc.coalesce(Expense.amount_inr, Expense.amount)),
        )
        .where(*filters)
        .group_by(Expense.category)
    ) if filters else (
        select(
            Expense.category,
            sqlfunc.sum(sqlfunc.coalesce(Expense.amount_inr, Expense.amount)),
        )
        .group_by(Expense.category)
    )
    cat_result = await db.execute(cat_q)
    by_category_float = {
        (r[0].value if r[0] else "other"): float(r[1] or 0)
        for r in cat_result.all()
    }

    return ExpenseSummaryOut(
        total_submitted=total_submitted, total_approved=total_approved,
        total_pending=total_pending, total_rejected=total_rejected,
        count_submitted=count_submitted, count_approved=count_approved,
        count_pending=count_pending, count_rejected=count_rejected,
        by_category=by_category_float,
    )


@router.post("/{expense_id}/receipt")
async def upload_receipt(
    expense_id:   uuid.UUID,
    file:         UploadFile = File(...),
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.employee_id != current_user.id and current_user.role == Role.EMPLOYEE:
        raise HTTPException(403, "Forbidden")

    ALLOWED_RECEIPT_EXT = {'.jpg', '.jpeg', '.png', '.pdf'}
    MAX_RECEIPT_SIZE = 5 * 1024 * 1024  # 5 MB

    safe_filename = os.path.basename(file.filename or "receipt.jpg")
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in ALLOWED_RECEIPT_EXT:
        raise HTTPException(400, f"Receipt type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_RECEIPT_EXT))}")

    content = await file.read()
    if len(content) > MAX_RECEIPT_SIZE:
        raise HTTPException(413, "Receipt file too large. Maximum size is 5MB.")

    upload_dir = "uploads/receipts"
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{expense_id}{ext}"
    path = os.path.join(upload_dir, filename)
    try:
        with open(path, "wb") as f:
            f.write(content)
    except OSError as e:
        raise HTTPException(500, f"Failed to save receipt: {e}")

    expense.receipt_url = f"/uploads/receipts/{filename}"
    await db.commit()
    return {"receipt_url": expense.receipt_url}


@router.patch("/{expense_id}/review", response_model=ExpenseOut)
async def review_expense(
    expense_id:   uuid.UUID,
    payload:      ExpenseUpdate,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("expense:approve")),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(400, "Already reviewed")

    # Managers can only approve their direct reports' expenses
    if current_user.role == Role.MANAGER:
        emp_res = await db.execute(select(User).where(User.id == expense.employee_id))
        emp = emp_res.scalar_one_or_none()
        if not emp or emp.manager_id != current_user.id:
            raise HTTPException(403, "Can only approve your direct reports' expenses")

    # Approval limit check — if set, manager cannot approve expenses exceeding their limit
    expense_amt = expense.amount_inr or expense.amount
    if current_user.approval_limit and expense_amt > current_user.approval_limit:
        raise HTTPException(
            403,
            f"Expense amount ₹{expense_amt} exceeds your approval limit of ₹{current_user.approval_limit}. Escalate to a higher authority.",
        )

    # Multi-stage approval flow
    next_level = (expense.current_approval_level or 0) + 1
    max_level = expense.max_approval_level or 1

    # Find the approval stage for this level
    stage_result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.expense_id == expense.id,
            ExpenseApproval.level == next_level,
        )
    )
    stage = stage_result.scalar_one_or_none()

    if payload.status == ExpenseStatus.REJECTED:
        # Rejection at any stage rejects the whole expense
        expense.status = ExpenseStatus.REJECTED
        expense.reviewed_by = current_user.id
        expense.reviewed_at = datetime.now(timezone.utc)
        if payload.reject_reason:
            expense.reject_reason = payload.reject_reason
        if stage:
            stage.status = ExpenseApprovalStage.REJECTED
            stage.approver_id = current_user.id
            stage.acted_at = datetime.now(timezone.utc)
            stage.comment = payload.reject_reason
    elif payload.status == ExpenseStatus.APPROVED:
        if stage:
            stage.status = ExpenseApprovalStage.APPROVED
            stage.approver_id = current_user.id
            stage.acted_at = datetime.now(timezone.utc)
        expense.current_approval_level = next_level

        if next_level >= max_level:
            # All stages approved — finalize
            expense.status = ExpenseStatus.APPROVED
            expense.reviewed_by = current_user.id
            expense.reviewed_at = datetime.now(timezone.utc)
        # else: stays PENDING, waiting for next-level approval
    else:
        expense.status = payload.status
        expense.reviewed_by = current_user.id
        expense.reviewed_at = datetime.now(timezone.utc)

    # Audit log
    outcome = "approved" if expense.status == ExpenseStatus.APPROVED else (
        "rejected" if expense.status == ExpenseStatus.REJECTED else f"stage_{next_level}_approved"
    )
    if payload.status == ExpenseStatus.APPROVED and next_level < max_level:
        outcome = f"stage_{next_level}_approved"
    await log_action(
        db, current_user, f"expense.{outcome}", "Expense", str(expense.id),
        description=f"{outcome} expense ₹{expense.amount} ({expense.category.value}) for employee {expense.employee_id} [level {next_level}/{max_level}]",
    )

    await db.commit()
    await db.refresh(expense)

    # Notify employee on final decision
    if expense.status in (ExpenseStatus.APPROVED, ExpenseStatus.REJECTED):
        final_outcome = "approved" if expense.status == ExpenseStatus.APPROVED else "rejected"
        reason_text = f" Reason: {expense.reject_reason}" if expense.reject_reason else ""
        await push_notification(
            db=db,
            user_id=expense.employee_id,
            type_=NotificationType.EXPENSE_REVIEWED,
            title=f"Expense {final_outcome.capitalize()}",
            message=f"Your expense claim of ₹{expense.amount} ({expense.category.value}) has been {final_outcome}.{reason_text}",
            link="/payroll/expenses",
        )

    return expense


@router.get("/{expense_id}/approvals")
async def get_approval_stages(
    expense_id:   uuid.UUID,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the multi-stage approval history for an expense."""
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if (current_user.role == Role.EMPLOYEE and expense.employee_id != current_user.id):
        raise HTTPException(403, "Forbidden")

    stages_result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.expense_id == expense_id
        ).order_by(ExpenseApproval.level)
    )
    stages = stages_result.scalars().all()
    return [
        {
            "level": s.level,
            "status": s.status.value,
            "approver_id": str(s.approver_id) if s.approver_id else None,
            "comment": s.comment,
            "acted_at": s.acted_at.isoformat() if s.acted_at else None,
        }
        for s in stages
    ]


@router.patch("/{expense_id}/cancel", response_model=ExpenseOut)
async def cancel_expense(
    expense_id:   uuid.UUID,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.employee_id != current_user.id:
        raise HTTPException(403, "Forbidden")
    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(400, "Can only cancel pending expenses")

    expense.status = ExpenseStatus.CANCELLED
    await db.commit()
    await db.refresh(expense)
    return expense


# ── Expense Policy CRUD ──────────────────────────────────────────────────────
@router.get("/policies", response_model=list[ExpensePolicyOut])
async def list_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("expense:manage_policies")),
):
    result = await db.execute(
        select(ExpensePolicy).where(ExpensePolicy.is_active == True)
    )
    return result.scalars().all()


@router.post("/policies", response_model=ExpensePolicyOut, status_code=201)
async def create_policy(
    payload: ExpensePolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("expense:manage_policies")),
):
    policy = ExpensePolicy(**payload.model_dump())
    db.add(policy)
    await log_action(
        db, current_user, "expense.policy_created", "ExpensePolicy", None,
        description=f"Created expense policy: {payload.category or 'global'}",
    )
    await db.commit()
    await db.refresh(policy)
    return policy


@router.delete("/policies/{policy_id}")
async def delete_policy(
    policy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("expense:manage_policies")),
):
    result = await db.execute(select(ExpensePolicy).where(ExpensePolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(404, "Policy not found")
    policy.is_active = False
    await log_action(
        db, current_user, "expense.policy_deactivated", "ExpensePolicy", str(policy_id),
        description=f"Deactivated expense policy: {policy.category or 'global'}",
    )
    await db.commit()
    return {"message": "Policy deactivated"}
