from pydantic import BaseModel, UUID4
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from typing import List
from app.models.payroll import PayrollStatus, ExpenseCategory, ExpenseStatus, PaymentMethod


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
    pf_employer:      Decimal = Decimal("0")
    tds_deduction:    Decimal
    esi_deduction:    Decimal
    esi_employer:     Decimal = Decimal("0")
    professional_tax: Decimal = Decimal("0")
    lop_deduction:    Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    tax_regime:       str = "new"
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
    title:          str
    category:       ExpenseCategory
    amount:         Decimal
    date:           date
    project_id:     Optional[UUID4] = None
    notes:          Optional[str]   = None
    currency:       str = "INR"
    exchange_rate:  Decimal = Decimal("1")
    mileage_km:     Optional[Decimal] = None
    is_billable:    bool = False
    merchant_name:  Optional[str] = None
    payment_method: Optional[PaymentMethod] = None


class ExpenseUpdate(BaseModel):
    status:        ExpenseStatus
    reject_reason: Optional[str] = None


class ExpenseOut(BaseModel):
    id:             UUID4
    employee_id:    UUID4
    title:          str
    category:       ExpenseCategory
    amount:         Decimal
    date:           date
    project_id:     Optional[UUID4] = None
    receipt_url:    Optional[str]   = None
    notes:          Optional[str]   = None
    status:         ExpenseStatus
    reviewed_by:    Optional[UUID4] = None
    reviewed_at:    Optional[datetime] = None
    reject_reason:  Optional[str]  = None
    currency:       str = "INR"
    exchange_rate:  Decimal = Decimal("1")
    amount_inr:     Optional[Decimal] = None
    mileage_km:     Optional[Decimal] = None
    mileage_rate:   Optional[Decimal] = None
    is_billable:    bool = False
    merchant_name:  Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    current_approval_level: int = 0
    max_approval_level:     int = 1
    created_at:     datetime

    class Config:
        from_attributes = True


# ── Expense Policy ───────────────────────────────────────────────────────────
class ExpensePolicyCreate(BaseModel):
    category:            Optional[ExpenseCategory] = None
    max_amount:          Optional[Decimal] = None
    requires_receipt:    bool = True
    requires_approval:   bool = True
    auto_approve_below:  Optional[Decimal] = None
    mileage_rate_per_km: Decimal = Decimal("8")
    allowed_currencies:  Optional[str] = None
    description:         Optional[str] = None


class ExpensePolicyOut(BaseModel):
    id:                  UUID4
    category:            Optional[ExpenseCategory] = None
    max_amount:          Optional[Decimal] = None
    requires_receipt:    bool
    requires_approval:   bool
    auto_approve_below:  Optional[Decimal] = None
    mileage_rate_per_km: Decimal
    allowed_currencies:  Optional[str] = None
    description:         Optional[str] = None
    is_active:           bool
    created_at:          datetime

    class Config:
        from_attributes = True


class ExpenseSummaryOut(BaseModel):
    total_submitted:  Decimal
    total_approved:   Decimal
    total_pending:    Decimal
    total_rejected:   Decimal
    count_submitted:  int
    count_approved:   int
    count_pending:    int
    count_rejected:   int
    by_category:      dict
