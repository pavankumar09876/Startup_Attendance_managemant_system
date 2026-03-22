"""Enterprise onboarding: BGV, checklist templates, invite-based onboarding,
multi-step employee approval, document requirements, onboarding pipeline,
joining instructions, status transitions audit.

Revision ID: 0028
Revises: 0027
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend employeestatus enum with new pipeline values ─────────────
    op.execute("ALTER TYPE employeestatus ADD VALUE IF NOT EXISTS 'offer_sent'")
    op.execute("ALTER TYPE employeestatus ADD VALUE IF NOT EXISTS 'offer_accepted'")
    op.execute("ALTER TYPE employeestatus ADD VALUE IF NOT EXISTS 'pre_onboarding'")
    op.execute("ALTER TYPE employeestatus ADD VALUE IF NOT EXISTS 'joined'")
    op.execute("ALTER TYPE employeestatus ADD VALUE IF NOT EXISTS 'training'")
    op.execute("ALTER TYPE employeestatus ADD VALUE IF NOT EXISTS 'bench'")

    # ── New columns on users (invite-based onboarding + timestamps) ────
    op.add_column("users", sa.Column("invite_token", sa.String(255), nullable=True, index=True))
    op.add_column("users", sa.Column("invite_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("invite_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("offer_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("offer_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("onboarding_stage", sa.String(30), nullable=True))

    # ── New columns on documents (requirements + expiry) ───────────────
    op.add_column("documents", sa.Column("is_required", sa.Boolean(), server_default="false"))
    op.add_column("documents", sa.Column("expiry_date", sa.Date(), nullable=True))
    # requirement_id FK added after document_requirements table is created (below)

    # ── New columns on pending_employee_requests (multi-step) ──────────
    op.add_column("pending_employee_requests", sa.Column("current_approval_level", sa.Integer(), server_default="0"))
    op.add_column("pending_employee_requests", sa.Column("max_approval_level", sa.Integer(), server_default="1"))
    op.add_column("pending_employee_requests", sa.Column("approval_chain_config", sa.Text(), nullable=True))

    # ── BGV status enum ────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bgvstatus') THEN
                CREATE TYPE bgvstatus AS ENUM ('pending', 'in_verification', 'cleared', 'failed');
            END IF;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bgvitemstatus') THEN
                CREATE TYPE bgvitemstatus AS ENUM ('pending', 'in_progress', 'verified', 'failed', 'not_applicable');
            END IF;
        END $$;
    """)

    # ── background_verifications ───────────────────────────────────────
    op.create_table(
        "background_verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("overall_result", sa.String(50), nullable=True),
        sa.Column("vendor_name", sa.String(200), nullable=True),
        sa.Column("initiated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("initiated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── bgv_items ──────────────────────────────────────────────────────
    op.create_table(
        "bgv_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("bgv_id", UUID(as_uuid=True), sa.ForeignKey("background_verifications.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("verified_by", sa.String(200), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── document_requirements ──────────────────────────────────────────
    op.create_table(
        "document_requirements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_role", sa.String(50), nullable=True),
        sa.Column("target_department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_mandatory", sa.Boolean(), server_default="true"),
        sa.Column("has_expiry", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Now add the FK column on documents (table exists now) ─────────
    op.add_column("documents", sa.Column(
        "requirement_id", UUID(as_uuid=True),
        sa.ForeignKey("document_requirements.id", ondelete="SET NULL"),
        nullable=True,
    ))

    # ── onboarding_checklist_templates ─────────────────────────────────
    op.create_table(
        "onboarding_checklist_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_role", sa.String(50), nullable=True),
        sa.Column("target_department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── checklist_template_items ───────────────────────────────────────
    op.create_table(
        "checklist_template_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("onboarding_checklist_templates.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), server_default="general"),
        sa.Column("assignee_role", sa.String(50), server_default="hr"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("is_required", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── employee_checklist_items ───────────────────────────────────────
    op.create_table(
        "employee_checklist_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("template_item_id", UUID(as_uuid=True), sa.ForeignKey("checklist_template_items.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(50), server_default="general"),
        sa.Column("assignee_role", sa.String(50), server_default="hr"),
        sa.Column("assignee_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_completed", sa.Boolean(), server_default="false"),
        sa.Column("completed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("is_required", sa.Boolean(), server_default="true"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── employee_approval_steps (multi-step employee creation) ─────────
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employeeapprovalstepstatus') THEN
                CREATE TYPE employeeapprovalstepstatus AS ENUM ('pending', 'approved', 'rejected', 'skipped');
            END IF;
        END $$;
    """)

    op.create_table(
        "employee_approval_steps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey("pending_employee_requests.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("approver_role", sa.String(50), nullable=False),
        sa.Column("approver_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("acted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── onboarding_status_transitions (audit) ──────────────────────────
    op.create_table(
        "onboarding_status_transitions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("from_status", sa.String(30), nullable=True),
        sa.Column("to_status", sa.String(30), nullable=False),
        sa.Column("transitioned_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── joining_instructions (templates) ───────────────────────────────
    op.create_table(
        "joining_instructions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("body_html", sa.Text(), nullable=False),
        sa.Column("target_role", sa.String(50), nullable=True),
        sa.Column("target_department_id", UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── employee_joining_details ───────────────────────────────────────
    op.create_table(
        "employee_joining_details",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("employee_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True, index=True),
        sa.Column("first_day_schedule", sa.Text(), nullable=True),
        sa.Column("reporting_location", sa.String(200), nullable=True),
        sa.Column("reporting_time", sa.String(20), nullable=True),
        sa.Column("reporting_manager_notified", sa.Boolean(), server_default="false"),
        sa.Column("joining_kit_sent", sa.Boolean(), server_default="false"),
        sa.Column("instructions_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("employee_joining_details")
    op.drop_table("joining_instructions")
    op.drop_table("onboarding_status_transitions")
    op.drop_table("employee_approval_steps")
    sa.Enum(name="employeeapprovalstepstatus").drop(op.get_bind(), checkfirst=True)
    op.drop_table("employee_checklist_items")
    op.drop_table("checklist_template_items")
    op.drop_table("onboarding_checklist_templates")
    # Drop documents columns before dropping document_requirements (FK dependency)
    op.drop_column("documents", "requirement_id")
    op.drop_column("documents", "expiry_date")
    op.drop_column("documents", "is_required")
    op.drop_table("document_requirements")
    op.drop_table("bgv_items")
    op.drop_table("background_verifications")
    sa.Enum(name="bgvitemstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="bgvstatus").drop(op.get_bind(), checkfirst=True)
    op.drop_column("pending_employee_requests", "approval_chain_config")
    op.drop_column("pending_employee_requests", "max_approval_level")
    op.drop_column("pending_employee_requests", "current_approval_level")
    op.drop_column("users", "onboarding_stage")
    op.drop_column("users", "joined_at")
    op.drop_column("users", "offer_accepted_at")
    op.drop_column("users", "offer_sent_at")
    op.drop_column("users", "invite_accepted_at")
    op.drop_column("users", "invite_token_expires_at")
    op.drop_column("users", "invite_token")
    # Note: PostgreSQL cannot remove values from an enum without dropping/recreating it.
    # The 6 new employeestatus values (offer_sent, etc.) remain in the enum after downgrade.
