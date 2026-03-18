"""Add time_logs table for task time tracking

Revision ID: 0025
Revises: 0024
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "time_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("task_id", UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("hours", sa.Numeric(6, 2), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Composite index for querying logs per task ordered by date
    op.create_index("ix_time_logs_task_date", "time_logs", ["task_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_time_logs_task_date")
    op.drop_table("time_logs")
