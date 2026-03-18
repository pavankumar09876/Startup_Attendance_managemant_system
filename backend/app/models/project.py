from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Enum, Text, Integer, Table, Boolean, Numeric, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum

from app.database import Base


class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, enum.Enum):
    TODO        = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW   = "in_review"
    DONE        = "done"
    BLOCKED     = "blocked"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IssueType(str, enum.Enum):
    TASK  = "task"
    BUG   = "bug"
    STORY = "story"
    EPIC  = "epic"


class ProjectRole(str, enum.Enum):
    OWNER       = "owner"
    MANAGER     = "manager"
    CONTRIBUTOR = "contributor"
    VIEWER      = "viewer"


# Many-to-many: project members with role
project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id"), primary_key=True),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("role", String(20), nullable=False, default="contributor"),
)


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    client_name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.PLANNING)
    priority = Column(Enum(ProjectPriority), default=ProjectPriority.MEDIUM)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    budget = Column(Numeric(14, 2), nullable=True)
    spent = Column(Numeric(14, 2), default=0)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    progress = Column(Integer, default=0)   # 0–100
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    manager = relationship("User", foreign_keys=[manager_id])
    members = relationship("User", secondary=project_members)
    tasks   = relationship("Task",   back_populates="project", cascade="all, delete-orphan")
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.TODO)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    due_date = Column(Date, nullable=True)
    estimated_hours = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    sprint_id    = Column(UUID(as_uuid=True), ForeignKey("sprints.id", ondelete="SET NULL"),
                          nullable=True, index=True)
    story_points = Column(Integer, nullable=True)
    issue_type   = Column(Enum(IssueType), default=IssueType.TASK, nullable=False)
    labels       = Column(ARRAY(String(50)), nullable=False, server_default="{}")

    # Subtask support
    parent_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)

    # Epic linkage — the epic this task belongs to (must be a task with issue_type=epic)
    epic_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)

    project  = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks")
    sprint   = relationship("Sprint", back_populates="tasks")
    parent   = relationship("Task", remote_side="Task.id", foreign_keys=[parent_id], backref="subtasks")
    epic     = relationship("Task", remote_side="Task.id", foreign_keys=[epic_id], backref="epic_children", lazy="joined")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")

    @property
    def epic_title(self) -> str | None:
        return self.epic.title if self.epic else None


class TaskDependency(Base):
    """Task dependency — task depends on blocking_task."""
    __tablename__ = "task_dependencies"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id          = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    blocking_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class TaskComment(Base):
    """Comments on tasks."""
    __tablename__ = "task_comments"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id    = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    task = relationship("Task", back_populates="comments")
    user = relationship("User")


class TaskActivity(Base):
    """Immutable log of changes made to tasks — who changed what, when."""
    __tablename__ = "task_activities"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id    = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    actor_name = Column(String(150), nullable=False)
    action     = Column(String(50), nullable=False)  # created, updated, deleted, commented
    field      = Column(String(50), nullable=True)    # e.g. status, assignee_id, priority
    old_value  = Column(String(500), nullable=True)
    new_value  = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task  = relationship("Task")
    actor = relationship("User")


class RecurringTask(Base):
    """Template for tasks that recur on a schedule."""
    __tablename__ = "recurring_tasks"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id      = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title           = Column(String(300), nullable=False)
    description     = Column(Text, nullable=True)
    priority        = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    assignee_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    recurrence_rule = Column(String(50), nullable=False)  # daily, weekly, biweekly, monthly
    is_active       = Column(Boolean, default=True)
    last_created_at = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class TimeLog(Base):
    """Time logged against a task by a user."""
    __tablename__ = "time_logs"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id     = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    hours       = Column(Numeric(6, 2), nullable=False)
    description = Column(String(500), nullable=True)
    date        = Column(Date, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task")
    user = relationship("User")


class SavedTaskView(Base):
    """User-saved filter presets for the task list (e.g. 'My bugs', 'Overdue tasks')."""
    __tablename__ = "saved_task_views"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name       = Column(String(100), nullable=False)
    filters    = Column(JSONB, nullable=False, default=dict)  # {status, priority, label, due, ...}
    is_default = Column(Boolean, default=False)
    position   = Column(Integer, default=0)  # ordering
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
