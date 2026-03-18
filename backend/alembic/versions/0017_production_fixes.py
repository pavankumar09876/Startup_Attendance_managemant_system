"""production fixes — unique attendance constraint, notification pref FK, cascade deletes, widen employee_id

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = '0017'
down_revision = '0016'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ── 1. Unique constraint on attendance (employee_id, date) ───────────────
    op.create_unique_constraint(
        'uq_attendance_employee_date',
        'attendance',
        ['employee_id', 'date'],
    )

    # ── 2. Fix NotificationPreference.user_id: String → UUID + FK ────────────
    op.alter_column(
        'notification_preferences',
        'user_id',
        type_=postgresql.UUID(as_uuid=True),
        existing_type=sa.String(50),
        postgresql_using='user_id::uuid',
    )
    op.create_foreign_key(
        'fk_notif_pref_user',
        'notification_preferences',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # ── 3. Add ondelete CASCADE to recurring_tasks.project_id ────────────────
    op.drop_constraint(
        'recurring_tasks_project_id_fkey',
        'recurring_tasks',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'recurring_tasks_project_id_fkey',
        'recurring_tasks',
        'projects',
        ['project_id'],
        ['id'],
        ondelete='CASCADE',
    )

    # ── 4. Add ondelete SET NULL to users.department_id ──────────────────────
    op.drop_constraint(
        'users_department_id_fkey',
        'users',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'users_department_id_fkey',
        'users',
        'departments',
        ['department_id'],
        ['id'],
        ondelete='SET NULL',
    )

    # ── 5. Widen employee_id column to String(50) for UUID format ────────────
    op.alter_column(
        'users',
        'employee_id',
        type_=sa.String(50),
        existing_type=sa.String(20),
    )


def downgrade() -> None:
    # ── 5. Revert employee_id back to String(20) ────────────────────────────
    op.alter_column(
        'users',
        'employee_id',
        type_=sa.String(20),
        existing_type=sa.String(50),
    )

    # ── 4. Revert users.department_id FK (remove SET NULL) ───────────────────
    op.drop_constraint(
        'users_department_id_fkey',
        'users',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'users_department_id_fkey',
        'users',
        'departments',
        ['department_id'],
        ['id'],
    )

    # ── 3. Revert recurring_tasks.project_id FK (remove CASCADE) ─────────────
    op.drop_constraint(
        'recurring_tasks_project_id_fkey',
        'recurring_tasks',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'recurring_tasks_project_id_fkey',
        'recurring_tasks',
        'projects',
        ['project_id'],
        ['id'],
    )

    # ── 2. Revert notification_preferences.user_id FK + type ─────────────────
    op.drop_constraint(
        'fk_notif_pref_user',
        'notification_preferences',
        type_='foreignkey',
    )
    op.alter_column(
        'notification_preferences',
        'user_id',
        type_=sa.String(50),
        existing_type=postgresql.UUID(as_uuid=True),
        postgresql_using='user_id::text',
    )

    # ── 1. Drop unique attendance constraint ─────────────────────────────────
    op.drop_constraint(
        'uq_attendance_employee_date',
        'attendance',
        type_='unique',
    )
