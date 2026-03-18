from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class UserSession(Base):
    __tablename__ = "user_sessions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti         = Column(String(64), unique=True, nullable=False)  # Links to refresh token
    device_info = Column(String(500), nullable=True)  # User-Agent
    ip_address  = Column(String(45), nullable=True)
    last_active = Column(DateTime(timezone=True), server_default=func.now())
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    is_active   = Column(Boolean, default=True)

    user = relationship("User")
