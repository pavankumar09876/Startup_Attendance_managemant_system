"""Add epic_id column to tasks for real epic hierarchy

Revision ID: 0026
Revises: 0025
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "epic_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tasks_epic_id", "tasks", ["epic_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_epic_id")
    op.drop_column("tasks", "epic_id")
