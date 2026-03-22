"""Add onboarding settings to company_settings (bgv_required, stale_days).

Revision ID: 0029
Revises: 0028
"""
from alembic import op
import sqlalchemy as sa

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "company_settings",
        sa.Column("bgv_required", sa.Boolean(), nullable=True, server_default="false"),
    )
    op.add_column(
        "company_settings",
        sa.Column("onboarding_stale_days", sa.Integer(), nullable=True, server_default="7"),
    )


def downgrade():
    op.drop_column("company_settings", "onboarding_stale_days")
    op.drop_column("company_settings", "bgv_required")
