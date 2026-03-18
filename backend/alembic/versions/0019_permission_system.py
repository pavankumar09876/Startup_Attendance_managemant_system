"""Add permission system, leave approvals, payroll finalization

Revision ID: 0019
Revises: 0018
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── permissions table ──────────────────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── default_role_permissions table ─────────────────────────────────────
    op.create_table(
        "default_role_permissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("role", sa.String(50), nullable=False, index=True),
        sa.Column("permission_code", sa.String(100), nullable=False, index=True),
    )

    # ── leave_approvals table (multi-level) ────────────────────────────────
    # Drop leftover enum from previous failed migration attempt (if any)
    op.execute("DROP TYPE IF EXISTS leaveapprovalstatus CASCADE")

    # Use String column to avoid SQLAlchemy enum creation conflicts
    op.create_table(
        "leave_approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("leave_id", UUID(as_uuid=True), sa.ForeignKey("leaves.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("approver_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("level", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("comments", sa.Text, nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── payroll: add FINALIZED status and finalization columns ─────────────
    op.execute("ALTER TYPE payrollstatus ADD VALUE IF NOT EXISTS 'finalized'")
    op.add_column("payroll_entries", sa.Column("finalized_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("payroll_entries", sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("payroll_entries", "finalized_at")
    op.drop_column("payroll_entries", "finalized_by")
    op.drop_table("leave_approvals")
    op.execute("DROP TYPE IF EXISTS leaveapprovalstatus")
    op.drop_table("default_role_permissions")
    op.drop_table("permissions")
