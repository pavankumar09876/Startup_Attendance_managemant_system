from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class RevokedToken(Base):
    """Blacklisted JWTs — checked on every authenticated request."""
    __tablename__ = "revoked_tokens"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti        = Column(String(64), nullable=False, unique=True, index=True)
    user_id    = Column(String(64), nullable=False, index=True)   # str(uuid)
    revoked_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)   # mirrors token exp
