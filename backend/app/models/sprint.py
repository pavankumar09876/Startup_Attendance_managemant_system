from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Enum, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class SprintStatus(str, enum.Enum):
    PLANNED   = "planned"
    ACTIVE    = "active"
    COMPLETED = "completed"


class Sprint(Base):
    __tablename__ = "sprints"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    name         = Column(String(200), nullable=False)
    goal         = Column(Text, nullable=True)
    status       = Column(Enum(SprintStatus), default=SprintStatus.PLANNED, nullable=False)
    start_date   = Column(Date, nullable=True)
    end_date     = Column(Date, nullable=True)
    capacity     = Column(Integer, nullable=True)   # story-point capacity
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="sprints")
    tasks   = relationship("Task",   back_populates="sprint")
