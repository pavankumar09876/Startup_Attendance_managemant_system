from sqlalchemy import (
    Column, String, Date, DateTime, ForeignKey, Enum, Text,
    Integer, Boolean, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class PayrollStatus(str, enum.Enum):
    PENDING   = "pending"
    PROCESSED = "processed"   # HR ran payroll
    FINALIZED = "finalized"   # Admin approved the run
    PAID      = "paid"        # Disbursed


class ExpenseCategory(str, enum.Enum):
    TRAVEL    = "travel"
    MEALS     = "meals"
    EQUIPMENT = "equipment"
    SOFTWARE  = "software"
    MILEAGE   = "mileage"
    OTHER     = "other"


class PaymentMethod(str, enum.Enum):
    CASH          = "cash"
    COMPANY_CARD  = "company_card"
    PERSONAL_CARD = "personal_card"
    UPI           = "upi"
    BANK_TRANSFER = "bank_transfer"


class ExpenseStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class PayrollEntry(Base):
    """One payroll record per employee per month."""
    __tablename__ = "payroll_entries"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    month               = Column(Integer, nullable=False)   # 1–12
    year                = Column(Integer, nullable=False)
    basic_salary        = Column(Numeric(12, 2), nullable=False, default=0)
    hra                 = Column(Numeric(12, 2), default=0)
    travel_allowance    = Column(Numeric(12, 2), default=0)
    other_allowances    = Column(Numeric(12, 2), default=0)
    overtime_pay        = Column(Numeric(12, 2), default=0)
    bonus               = Column(Numeric(12, 2), default=0)
    gross_salary        = Column(Numeric(12, 2), nullable=False, default=0)
    pf_deduction        = Column(Numeric(12, 2), default=0)   # 12% of basic (employee)
    pf_employer         = Column(Numeric(12, 2), default=0)   # 12% of basic (employer)
    tds_deduction       = Column(Numeric(12, 2), default=0)
    esi_deduction       = Column(Numeric(12, 2), default=0)   # employee share
    esi_employer        = Column(Numeric(12, 2), default=0)   # employer share
    professional_tax    = Column(Numeric(12, 2), default=0)
    lop_deduction       = Column(Numeric(12, 2), default=0)   # loss of pay
    other_deductions    = Column(Numeric(12, 2), default=0)
    total_deductions    = Column(Numeric(12, 2), nullable=False, default=0)
    tax_regime          = Column(String(10), default="new")   # "new" or "old"
    net_salary          = Column(Numeric(12, 2), nullable=False, default=0)
    working_days        = Column(Integer, default=0)
    paid_days           = Column(Integer, default=0)
    lop_days            = Column(Integer, default=0)
    status              = Column(Enum(PayrollStatus), default=PayrollStatus.PENDING)
    processed_at        = Column(DateTime(timezone=True), nullable=True)
    paid_at             = Column(DateTime(timezone=True), nullable=True)
    processed_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    finalized_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    finalized_at        = Column(DateTime(timezone=True), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    employee   = relationship("User", foreign_keys=[employee_id])
    processor  = relationship("User", foreign_keys=[processed_by])
    finalizer  = relationship("User", foreign_keys=[finalized_by])


class PayrollRevision(Base):
    """Tracks changes to payroll entries after finalization (corrections, adjustments)."""
    __tablename__ = "payroll_revisions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_entry_id = Column(UUID(as_uuid=True), ForeignKey("payroll_entries.id"), nullable=False, index=True)
    revision_number = Column(Integer, nullable=False, default=1)
    field_changed   = Column(String(100), nullable=False)
    old_value       = Column(String(200), nullable=True)
    new_value       = Column(String(200), nullable=True)
    reason          = Column(Text, nullable=True)
    revised_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    payroll_entry = relationship("PayrollEntry", backref="revisions")
    revisor       = relationship("User", foreign_keys=[revised_by])


class LeaveBalance(Base):
    """Tracks remaining leave balance per employee per year."""
    __tablename__ = "leave_balances"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    year        = Column(Integer, nullable=False)
    leave_type  = Column(String(50), nullable=False)
    total_days  = Column(Numeric(6, 1), default=0)
    used_days   = Column(Numeric(6, 1), default=0)
    pending_days = Column(Numeric(6, 1), default=0)
    carried_forward = Column(Numeric(6, 1), default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("User")


class Expense(Base):
    __tablename__ = "expenses"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title       = Column(String(200), nullable=False)
    category    = Column(Enum(ExpenseCategory), nullable=False)
    amount      = Column(Numeric(12, 2), nullable=False)
    date        = Column(Date, nullable=False)
    project_id  = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    receipt_url = Column(String(500), nullable=True)
    notes       = Column(Text, nullable=True)
    status      = Column(Enum(ExpenseStatus), default=ExpenseStatus.PENDING)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reject_reason = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    # Multi-currency support
    currency      = Column(String(3), default="INR")
    exchange_rate = Column(Numeric(12, 6), default=1)
    amount_inr    = Column(Numeric(12, 2), nullable=True)  # auto-calculated

    # Mileage tracking
    mileage_km    = Column(Numeric(8, 2), nullable=True)
    mileage_rate  = Column(Numeric(6, 2), nullable=True)  # per km rate

    # Extra metadata
    is_billable    = Column(Boolean, default=False)
    merchant_name  = Column(String(200), nullable=True)
    payment_method = Column(Enum(PaymentMethod), nullable=True)

    # Multi-stage approval tracking
    current_approval_level = Column(Integer, default=0)
    max_approval_level     = Column(Integer, default=1)  # how many stages needed

    employee = relationship("User", foreign_keys=[employee_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class ExpenseApprovalStage(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED  = "skipped"


class ExpenseApproval(Base):
    """Multi-stage approval record for an expense."""
    __tablename__ = "expense_approvals"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_id  = Column(UUID(as_uuid=True), ForeignKey("expenses.id"), nullable=False, index=True)
    level       = Column(Integer, nullable=False, default=1)  # 1=manager, 2=finance, 3=cfo etc.
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status      = Column(Enum(ExpenseApprovalStage), default=ExpenseApprovalStage.PENDING)
    comment     = Column(Text, nullable=True)
    acted_at    = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    expense  = relationship("Expense", backref="approval_stages")
    approver = relationship("User", foreign_keys=[approver_id])


class PayslipVersion(Base):
    """Immutable snapshot of a payslip at a point in time."""
    __tablename__ = "payslip_versions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_entry_id = Column(UUID(as_uuid=True), ForeignKey("payroll_entries.id"), nullable=False, index=True)
    version          = Column(Integer, nullable=False, default=1)
    snapshot         = Column(Text, nullable=False)  # JSON blob of all salary fields
    reason           = Column(Text, nullable=True)
    created_by       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    payroll_entry = relationship("PayrollEntry", backref="versions")
    creator       = relationship("User", foreign_keys=[created_by])


class ExpensePolicy(Base):
    """Company-wide or category-specific expense policy rules."""
    __tablename__ = "expense_policies"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category            = Column(Enum(ExpenseCategory), nullable=True)  # null = all categories
    max_amount          = Column(Numeric(12, 2), nullable=True)
    requires_receipt    = Column(Boolean, default=True)
    requires_approval   = Column(Boolean, default=True)
    auto_approve_below  = Column(Numeric(12, 2), nullable=True)
    mileage_rate_per_km = Column(Numeric(6, 2), default=8)  # INR per km
    allowed_currencies  = Column(Text, nullable=True)  # JSON array
    description         = Column(Text, nullable=True)
    is_active           = Column(Boolean, default=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())
