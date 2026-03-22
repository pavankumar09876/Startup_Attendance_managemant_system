"""SLA tracking for onboarding stages.

Revision ID: 0030
Revises: 0029
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade():
    # ── Onboarding SLA configuration (per-stage deadlines) ──────────────────
    op.create_table(
        "onboarding_sla_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("stage", sa.String(30), nullable=False, unique=True),
        sa.Column("max_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("escalation_role", sa.String(50), nullable=True, server_default="admin"),
        sa.Column("auto_notify", sa.Boolean(), server_default="true"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── SLA breach records ──────────────────────────────────────────────────
    op.create_table(
        "sla_breaches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("stage", sa.String(30), nullable=False),
        sa.Column("sla_days", sa.Integer(), nullable=False),
        sa.Column("actual_days", sa.Integer(), nullable=False),
        sa.Column("breached_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalated_to", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sla_breaches_stage", "sla_breaches", ["stage"])
    op.create_index("ix_sla_breaches_resolved", "sla_breaches", ["resolved_at"])


def downgrade():
    op.drop_table("sla_breaches")
    op.drop_table("onboarding_sla_configs")
