"""Expenses router — /api/expenses"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Optional
import uuid
import os

from app.database import get_db
from app.models.payroll import Expense, ExpenseStatus
from app.models.user import User, Role
from app.schemas.payroll import ExpenseCreate, ExpenseUpdate, ExpenseOut
from app.utils.dependencies import get_current_user, require_roles

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("/", response_model=list[ExpenseOut])
async def list_expenses(
    employee_id:   Optional[uuid.UUID] = None,
    status:        Optional[ExpenseStatus] = None,
    skip:          int = Query(0, ge=0),
    limit:         int = Query(50, ge=1, le=200),
    db:            AsyncSession = Depends(get_db),
    current_user:  User = Depends(get_current_user),
):
    q = select(Expense)
    if current_user.role == Role.EMPLOYEE:
        q = q.where(Expense.employee_id == current_user.id)
    elif employee_id:
        q = q.where(Expense.employee_id == employee_id)
    if status:
        q = q.where(Expense.status == status)
    q = q.order_by(Expense.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=ExpenseOut, status_code=201)
async def submit_expense(
    payload:      ExpenseCreate,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = Expense(**payload.model_dump(), employee_id=current_user.id)
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


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

    # In production, upload to S3/GCS. For now, save locally.
    upload_dir = "uploads/receipts"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "receipt.jpg")[1]
    filename = f"{expense_id}{ext}"
    path = os.path.join(upload_dir, filename)
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    expense.receipt_url = f"/uploads/receipts/{filename}"
    await db.commit()
    return {"receipt_url": expense.receipt_url}


@router.patch("/{expense_id}/review", response_model=ExpenseOut)
async def review_expense(
    expense_id:   uuid.UUID,
    payload:      ExpenseUpdate,
    db:           AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.MANAGER
    )),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(404, "Expense not found")
    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(400, "Already reviewed")

    expense.status      = payload.status
    expense.reviewed_by = current_user.id
    expense.reviewed_at = datetime.now(timezone.utc)
    if payload.reject_reason:
        expense.reject_reason = payload.reject_reason

    await db.commit()
    await db.refresh(expense)
    return expense


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
