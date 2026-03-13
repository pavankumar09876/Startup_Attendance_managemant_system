from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class NotificationType(str, enum.Enum):
    LEAVE_APPROVED     = "leave_approved"
    LEAVE_REJECTED     = "leave_rejected"
    TASK_ASSIGNED      = "task_assigned"
    PAYSLIP_READY      = "payslip_ready"
    ATTENDANCE_REGULARIZED = "attendance_regularized"
    PROJECT_DEADLINE   = "project_deadline"
    EXPENSE_REVIEWED   = "expense_reviewed"
    GENERAL            = "general"


class Notification(Base):
    __tablename__ = "notifications"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    type        = Column(Enum(NotificationType), nullable=False)
    title       = Column(String(200), nullable=False)
    message     = Column(Text, nullable=False)
    link        = Column(String(500), nullable=True)   # front-end route to navigate
    is_read     = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class AuditLog(Base):
    """Immutable audit trail — never delete rows."""
    __tablename__ = "audit_logs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor_name  = Column(String(150), nullable=True)   # denormalised for history
    action      = Column(String(100), nullable=False)  # e.g. "leave.approved"
    entity_type = Column(String(100), nullable=False)  # e.g. "Leave"
    entity_id   = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    metadata_   = Column("metadata", Text, nullable=True)  # JSON string
    ip_address  = Column(String(50), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("User", foreign_keys=[actor_id])
