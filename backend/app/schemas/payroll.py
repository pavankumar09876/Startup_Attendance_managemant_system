from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from app.models.payroll import PayrollStatus, ExpenseCategory, ExpenseStatus


# ── Payroll entry ─────────────────────────────────────────────────────────────
class PayrollEntryOut(BaseModel):
    id:               UUID4
    employee_id:      UUID4
    month:            int
    year:             int
    basic_salary:     Decimal
    hra:              Decimal
    travel_allowance: Decimal
    other_allowances: Decimal
    overtime_pay:     Decimal
    bonus:            Decimal
    gross_salary:     Decimal
    pf_deduction:     Decimal
    tds_deduction:    Decimal
    esi_deduction:    Decimal
    lop_deduction:    Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_salary:       Decimal
    working_days:     int
    paid_days:        int
    lop_days:         int
    status:           PayrollStatus
    processed_at:     Optional[datetime] = None
    paid_at:          Optional[datetime] = None
    created_at:       datetime

    class Config:
        from_attributes = True


class RunPayrollPayload(BaseModel):
    month: int
    year:  int


class PayrollSummary(BaseModel):
    total_employees: int
    processed:       int
    pending:         int
    paid:            int
    total_gross:     Decimal
    total_deductions: Decimal
    total_net:       Decimal


# ── Leave balance ─────────────────────────────────────────────────────────────
class LeaveBalanceOut(BaseModel):
    id:              UUID4
    employee_id:     UUID4
    year:            int
    leave_type:      str
    total_days:      Decimal
    used_days:       Decimal
    pending_days:    Decimal
    remaining_days:  Decimal = Decimal(0)
    carried_forward: Decimal

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_remaining(cls, obj):
        data = cls.model_validate(obj)
        data.remaining_days = obj.total_days - obj.used_days - obj.pending_days
        return data


# ── Expense ───────────────────────────────────────────────────────────────────
class ExpenseCreate(BaseModel):
    title:      str
    category:   ExpenseCategory
    amount:     Decimal
    date:       date
    project_id: Optional[UUID4] = None
    notes:      Optional[str]   = None


class ExpenseUpdate(BaseModel):
    status:        ExpenseStatus
    reject_reason: Optional[str] = None


class ExpenseOut(BaseModel):
    id:           UUID4
    employee_id:  UUID4
    title:        str
    category:     ExpenseCategory
    amount:       Decimal
    date:         date
    project_id:   Optional[UUID4] = None
    receipt_url:  Optional[str]   = None
    notes:        Optional[str]   = None
    status:       ExpenseStatus
    reviewed_by:  Optional[UUID4] = None
    reviewed_at:  Optional[datetime] = None
    reject_reason: Optional[str]  = None
    created_at:   datetime

    class Config:
        from_attributes = True
