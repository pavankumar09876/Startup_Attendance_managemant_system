"""Add task_activities table for issue history / activity log

Revision ID: 0022
Revises: 0021
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_activities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("actor_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("actor_name", sa.String(150), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("field", sa.String(50), nullable=True),
        sa.Column("old_value", sa.String(500), nullable=True),
        sa.Column("new_value", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_task_activities_task_created", "task_activities", ["task_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_task_activities_task_created")
    op.drop_table("task_activities")
