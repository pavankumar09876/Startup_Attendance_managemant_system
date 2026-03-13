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
    PROCESSED = "processed"
    PAID      = "paid"


class ExpenseCategory(str, enum.Enum):
    TRAVEL    = "travel"
    MEALS     = "meals"
    EQUIPMENT = "equipment"
    OTHER     = "other"


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
    pf_deduction        = Column(Numeric(12, 2), default=0)   # 12% of basic
    tds_deduction       = Column(Numeric(12, 2), default=0)
    esi_deduction       = Column(Numeric(12, 2), default=0)
    lop_deduction       = Column(Numeric(12, 2), default=0)   # loss of pay
    other_deductions    = Column(Numeric(12, 2), default=0)
    total_deductions    = Column(Numeric(12, 2), nullable=False, default=0)
    net_salary          = Column(Numeric(12, 2), nullable=False, default=0)
    working_days        = Column(Integer, default=0)
    paid_days           = Column(Integer, default=0)
    lop_days            = Column(Integer, default=0)
    status              = Column(Enum(PayrollStatus), default=PayrollStatus.PENDING)
    processed_at        = Column(DateTime(timezone=True), nullable=True)
    paid_at             = Column(DateTime(timezone=True), nullable=True)
    processed_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    employee   = relationship("User", foreign_keys=[employee_id])
    processor  = relationship("User", foreign_keys=[processed_by])


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

    employee = relationship("User", foreign_keys=[employee_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
