"""Enterprise governance: lifecycle, maker-checker, penalties, multi-stage expense,
payslip versioning, custom roles, IP whitelist, payroll revisions.

Covers audit items #5-#16 from the production security review.

Revision ID: 0027
Revises: 0026
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── #5 Employee lifecycle fields on users ─────────────────────────────
    employee_status = sa.Enum("invited", "active", "suspended", "terminated", name="employeestatus")
    employee_status.create(op.get_bind(), checkfirst=True)

    op.add_column("users", sa.Column("status", employee_status, nullable=True, server_default="active"))
    op.add_column("users", sa.Column("termination_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("termination_reason", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("suspension_reason", sa.Text(), nullable=True))

    # ── #7 Approval limit on users ────────────────────────────────────────
    op.add_column("users", sa.Column("approval_limit", sa.Numeric(12, 2), nullable=True))

    # ── #10 Maker-checker: pending employee requests ──────────────────────
    pending_req_status = sa.Enum("pending", "approved", "rejected", name="pendingemployeerequeststatus")
    pending_req_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "pending_employee_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("status", pending_req_status, server_default="pending"),
        sa.Column("requested_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── #9 Payroll revisions ──────────────────────────────────────────────
    op.create_table(
        "payroll_revisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("payroll_entry_id", UUID(as_uuid=True), sa.ForeignKey("payroll_entries.id"), nullable=False, index=True),
        sa.Column("revision_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("field_changed", sa.String(100), nullable=False),
        sa.Column("old_value", sa.String(200), nullable=True),
        sa.Column("new_value", sa.String(200), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("revised_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── #11 Attendance penalty config on attendance_config ────────────────
    op.add_column("attendance_config", sa.Column("late_penalty_enabled", sa.Boolean(), server_default="false"))
    op.add_column("attendance_config", sa.Column("late_penalty_amount", sa.Numeric(10, 2), server_default="0"))
    op.add_column("attendance_config", sa.Column("late_penalty_type", sa.String(20), server_default="fixed"))
    op.add_column("attendance_config", sa.Column("absent_penalty_enabled", sa.Boolean(), server_default="false"))
    op.add_column("attendance_config", sa.Column("absent_penalty_days", sa.Numeric(4, 1), server_default="1"))
    op.add_column("attendance_config", sa.Column("half_day_deduction_enabled", sa.Boolean(), server_default="false"))
    op.add_column("attendance_config", sa.Column("half_day_deduction_amount", sa.Numeric(10, 2), server_default="0"))
    op.add_column("attendance_config", sa.Column("max_late_days_before_deduction", sa.Integer(), server_default="3"))

    # ── #13 IP whitelist on company_settings ──────────────────────────────
    op.add_column("company_settings", sa.Column("admin_ip_whitelist", sa.JSON(), server_default="[]"))

    # ── #14 Custom roles ──────────────────────────────────────────────────
    op.create_table(
        "custom_roles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("permissions", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── #15 Multi-stage expense approval ──────────────────────────────────
    expense_approval_stage = sa.Enum("pending", "approved", "rejected", "skipped", name="expenseapprovalstage")
    expense_approval_stage.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "expense_approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("expense_id", UUID(as_uuid=True), sa.ForeignKey("expenses.id"), nullable=False, index=True),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("approver_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", expense_approval_stage, server_default="pending"),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("acted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.add_column("expenses", sa.Column("current_approval_level", sa.Integer(), server_default="0"))
    op.add_column("expenses", sa.Column("max_approval_level", sa.Integer(), server_default="1"))

    # ── #16 Payslip versioning ────────────────────────────────────────────
    op.create_table(
        "payslip_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("payroll_entry_id", UUID(as_uuid=True), sa.ForeignKey("payroll_entries.id"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("snapshot", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    # Reverse order
    op.drop_table("payslip_versions")
    op.drop_column("expenses", "max_approval_level")
    op.drop_column("expenses", "current_approval_level")
    op.drop_table("expense_approvals")
    sa.Enum(name="expenseapprovalstage").drop(op.get_bind(), checkfirst=True)
    op.drop_table("custom_roles")
    op.drop_column("company_settings", "admin_ip_whitelist")
    op.drop_column("attendance_config", "max_late_days_before_deduction")
    op.drop_column("attendance_config", "half_day_deduction_amount")
    op.drop_column("attendance_config", "half_day_deduction_enabled")
    op.drop_column("attendance_config", "absent_penalty_days")
    op.drop_column("attendance_config", "absent_penalty_enabled")
    op.drop_column("attendance_config", "late_penalty_type")
    op.drop_column("attendance_config", "late_penalty_amount")
    op.drop_column("attendance_config", "late_penalty_enabled")
    op.drop_table("payroll_revisions")
    op.drop_table("pending_employee_requests")
    sa.Enum(name="pendingemployeerequeststatus").drop(op.get_bind(), checkfirst=True)
    op.drop_column("users", "approval_limit")
    op.drop_column("users", "suspension_reason")
    op.drop_column("users", "suspended_at")
    op.drop_column("users", "termination_reason")
    op.drop_column("users", "termination_date")
    op.drop_column("users", "status")
    sa.Enum(name="employeestatus").drop(op.get_bind(), checkfirst=True)
