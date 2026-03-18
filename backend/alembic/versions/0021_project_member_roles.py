"""Add role column to project_members table

Revision ID: 0021
Revises: 0020
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_members",
        sa.Column("role", sa.String(20), nullable=False, server_default="contributor"),
    )
    # Set existing project managers as 'owner'
    op.execute(
        """
        UPDATE project_members pm
        SET role = 'owner'
        FROM projects p
        WHERE pm.project_id = p.id
          AND pm.user_id = p.manager_id
        """
    )


def downgrade() -> None:
    op.drop_column("project_members", "role")
