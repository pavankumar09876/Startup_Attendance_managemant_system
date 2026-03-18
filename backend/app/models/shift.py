from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Shift(Base):
    __tablename__ = "shifts"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name           = Column(String(100), nullable=False, unique=True)
    start_time     = Column(String(5), nullable=False)    # "HH:MM"
    end_time       = Column(String(5), nullable=False)    # "HH:MM"
    grace_minutes  = Column(Integer, default=10)
    is_night_shift = Column(Boolean, default=False)       # crosses midnight
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    employees = relationship("User", back_populates="shift")
