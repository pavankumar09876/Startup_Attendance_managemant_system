"""Add client_name, budget, spent, priority to projects; add active status to enum

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'active' to projectstatus enum
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'active'")

    # Create projectpriority enum
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'projectpriority') THEN CREATE TYPE projectpriority AS ENUM ('low', 'medium', 'high', 'critical'); END IF; END $$")

    # Add new columns
    op.add_column("projects", sa.Column("client_name", sa.String(200), nullable=True))
    op.add_column("projects", sa.Column("priority", sa.Enum("low", "medium", "high", "critical", name="projectpriority", create_type=False), nullable=True, server_default="medium"))
    op.add_column("projects", sa.Column("budget", sa.Numeric(14, 2), nullable=True))
    op.add_column("projects", sa.Column("spent", sa.Numeric(14, 2), nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("projects", "spent")
    op.drop_column("projects", "budget")
    op.drop_column("projects", "priority")
    op.drop_column("projects", "client_name")
    op.execute("DROP TYPE IF EXISTS projectpriority")
