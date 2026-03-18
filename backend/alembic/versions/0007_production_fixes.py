"""production fixes — revoked_all_before, payroll unique constraint, performance indexes

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = '0007'
down_revision = '0006'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ── users: revoked_all_before for logout-all session invalidation ──────────
    op.add_column('users', sa.Column(
        'revoked_all_before',
        sa.DateTime(timezone=True),
        nullable=True,
    ))

    # ── payroll_entries: unique constraint to prevent duplicate payroll runs ───
    op.create_unique_constraint(
        'uq_payroll_entries_employee_month_year',
        'payroll_entries',
        ['employee_id', 'month', 'year'],
    )

    # ── Performance indexes ────────────────────────────────────────────────────
    op.create_index('ix_attendance_date',          'attendance',      ['date'])
    op.create_index('ix_attendance_employee_date', 'attendance',      ['employee_id', 'date'])
    op.create_index('ix_leaves_status',            'leaves',          ['status'])
    op.create_index('ix_payroll_entries_month_year','payroll_entries', ['month', 'year'])
    op.create_index('ix_tasks_assignee_status',    'tasks',           ['assignee_id', 'status'])


def downgrade() -> None:
    op.drop_index('ix_tasks_assignee_status',     table_name='tasks')
    op.drop_index('ix_payroll_entries_month_year', table_name='payroll_entries')
    op.drop_index('ix_leaves_status',             table_name='leaves')
    op.drop_index('ix_attendance_employee_date',  table_name='attendance')
    op.drop_index('ix_attendance_date',           table_name='attendance')
    op.drop_constraint('uq_payroll_entries_employee_month_year', 'payroll_entries', type_='unique')
    op.drop_column('users', 'revoked_all_before')
