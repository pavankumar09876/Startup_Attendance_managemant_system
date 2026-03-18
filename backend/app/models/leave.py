from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Enum, Text, Integer, Boolean, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class LeaveType(str, enum.Enum):
    ANNUAL = "annual"
    SICK = "sick"
    CASUAL = "casual"
    MATERNITY = "maternity"
    PATERNITY = "paternity"
    UNPAID = "unpaid"
    COMP_OFF = "comp_off"


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class Leave(Base):
    __tablename__ = "leaves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    leave_type = Column(Enum(LeaveType), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Numeric(6, 1), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(Enum(LeaveStatus), default=LeaveStatus.PENDING)
    # Half-day support
    is_half_day = Column(Boolean, default=False)
    half_day_period = Column(String(20), nullable=True)  # "first_half" or "second_half"
    # Comp-off reference
    comp_off_date = Column(Date, nullable=True)  # The date worked that earned this comp-off
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("User", foreign_keys=[employee_id], back_populates="leave_requests")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    approvals = relationship("LeaveApproval", back_populates="leave", order_by="LeaveApproval.level")


class LeaveApprovalStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LeaveApproval(Base):
    """Multi-level leave approval tracking.
    Level 1 = Manager, Level 2 = HR/Admin (configurable).
    """
    __tablename__ = "leave_approvals"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    leave_id    = Column(UUID(as_uuid=True), ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False, index=True)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    level       = Column(Integer, nullable=False, default=1)  # 1 = manager, 2 = HR/admin
    status      = Column(Enum(LeaveApprovalStatus), default=LeaveApprovalStatus.PENDING)
    comments    = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    leave    = relationship("Leave", back_populates="approvals")
    approver = relationship("User", foreign_keys=[approver_id])
