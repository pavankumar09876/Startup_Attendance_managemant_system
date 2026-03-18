"""Add labels column to tasks table

Revision ID: 0023
Revises: 0022
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("labels", sa.ARRAY(sa.String(50)), nullable=False, server_default="{}"),
    )
    # GIN index for fast label filtering (e.g. WHERE 'bug' = ANY(labels))
    op.create_index("ix_tasks_labels", "tasks", ["labels"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_tasks_labels")
    op.drop_column("tasks", "labels")
