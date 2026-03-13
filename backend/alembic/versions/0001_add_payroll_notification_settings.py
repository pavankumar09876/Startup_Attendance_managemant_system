"""add payroll, notification, settings tables

Revision ID: 0001
Revises:
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── payroll_entries ──────────────────────────────────────────────────────────
    op.create_table(
        'payroll_entries',
        sa.Column('id',               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id',      postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('month',            sa.Integer, nullable=False),
        sa.Column('year',             sa.Integer, nullable=False),
        sa.Column('basic_salary',     sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('hra',              sa.Numeric(12, 2), server_default='0'),
        sa.Column('travel_allowance', sa.Numeric(12, 2), server_default='0'),
        sa.Column('other_allowances', sa.Numeric(12, 2), server_default='0'),
        sa.Column('overtime_pay',     sa.Numeric(12, 2), server_default='0'),
        sa.Column('bonus',            sa.Numeric(12, 2), server_default='0'),
        sa.Column('gross_salary',     sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('pf_deduction',     sa.Numeric(12, 2), server_default='0'),
        sa.Column('tds_deduction',    sa.Numeric(12, 2), server_default='0'),
        sa.Column('esi_deduction',    sa.Numeric(12, 2), server_default='0'),
        sa.Column('lop_deduction',    sa.Numeric(12, 2), server_default='0'),
        sa.Column('total_deductions', sa.Numeric(12, 2), server_default='0'),
        sa.Column('net_salary',       sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('working_days',     sa.Integer, server_default='26'),
        sa.Column('paid_days',        sa.Integer, server_default='26'),
        sa.Column('lop_days',         sa.Integer, server_default='0'),
        sa.Column('status',           sa.String(20), nullable=False, server_default='processed'),
        sa.Column('processed_at',     sa.DateTime(timezone=True)),
        sa.Column('paid_at',          sa.DateTime(timezone=True)),
        sa.Column('processed_by',     postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at',       sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at',       sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('employee_id', 'month', 'year', name='uq_payroll_employee_month_year'),
    )

    # ── leave_balances ───────────────────────────────────────────────────────────
    op.create_table(
        'leave_balances',
        sa.Column('id',              postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id',     postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('year',            sa.Integer, nullable=False),
        sa.Column('leave_type',      sa.String(30), nullable=False),
        sa.Column('total_days',      sa.Numeric(5, 1), server_default='0'),
        sa.Column('used_days',       sa.Numeric(5, 1), server_default='0'),
        sa.Column('carry_forward',   sa.Numeric(5, 1), server_default='0'),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at',      sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('employee_id', 'year', 'leave_type', name='uq_leave_balance_emp_year_type'),
    )

    # ── expenses ─────────────────────────────────────────────────────────────────
    op.create_table(
        'expenses',
        sa.Column('id',           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id',  postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('project_id',   postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
        sa.Column('date',         sa.Date, nullable=False),
        sa.Column('description',  sa.Text, nullable=False),
        sa.Column('category',     sa.String(20), nullable=False, server_default='other'),
        sa.Column('amount',       sa.Numeric(10, 2), nullable=False),
        sa.Column('currency',     sa.String(3), server_default='INR'),
        sa.Column('receipt_url',  sa.Text),
        sa.Column('status',       sa.String(20), nullable=False, server_default='pending'),
        sa.Column('approved_by',  postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('notes',        sa.Text),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at',   sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── notifications ────────────────────────────────────────────────────────────
    op.create_table(
        'notifications',
        sa.Column('id',         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id',    postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('type',       sa.String(40), nullable=False),
        sa.Column('title',      sa.String(200), nullable=False),
        sa.Column('message',    sa.Text, nullable=False),
        sa.Column('link',       sa.Text),
        sa.Column('is_read',    sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── audit_logs ───────────────────────────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id',          postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('actor_id',    postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('actor_name',  sa.String(200)),
        sa.Column('action',      sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(100)),
        sa.Column('entity_id',   sa.String(100)),
        sa.Column('metadata_',   sa.Text),
        sa.Column('ip_address',  sa.String(50)),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── company_settings ─────────────────────────────────────────────────────────
    op.create_table(
        'company_settings',
        sa.Column('id',               postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_name',     sa.String(200)),
        sa.Column('timezone',         sa.String(50), server_default='Asia/Kolkata'),
        sa.Column('date_format',      sa.String(20), server_default='DD/MM/YYYY'),
        sa.Column('currency',         sa.String(3),  server_default='INR'),
        sa.Column('fiscal_year_start',sa.Integer,    server_default='4'),
        sa.Column('logo_url',         sa.Text),
        sa.Column('updated_at',       sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── attendance_config ────────────────────────────────────────────────────────
    op.create_table(
        'attendance_config',
        sa.Column('id',              postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('check_in_start',  sa.String(5),  server_default='09:00'),
        sa.Column('check_in_end',    sa.String(5),  server_default='10:30'),
        sa.Column('check_out_time',  sa.String(5),  server_default='18:00'),
        sa.Column('late_threshold',  sa.Integer,    server_default='15'),
        sa.Column('half_day_hours',  sa.Numeric(4, 2), server_default='4.0'),
        sa.Column('full_day_hours',  sa.Numeric(4, 2), server_default='8.0'),
        sa.Column('geofence_enabled',sa.Boolean,    server_default='false'),
        sa.Column('office_lat',      sa.Numeric(10, 7)),
        sa.Column('office_lng',      sa.Numeric(10, 7)),
        sa.Column('geofence_radius', sa.Integer,    server_default='200'),
        sa.Column('updated_at',      sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── leave_policy ─────────────────────────────────────────────────────────────
    op.create_table(
        'leave_policy',
        sa.Column('id',                postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('annual_leave_days', sa.Integer, server_default='21'),
        sa.Column('sick_leave_days',   sa.Integer, server_default='10'),
        sa.Column('casual_leave_days', sa.Integer, server_default='7'),
        sa.Column('maternity_days',    sa.Integer, server_default='180'),
        sa.Column('paternity_days',    sa.Integer, server_default='15'),
        sa.Column('carry_forward_max', sa.Integer, server_default='10'),
        sa.Column('updated_at',        sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── role_permissions ─────────────────────────────────────────────────────────
    op.create_table(
        'role_permissions',
        sa.Column('id',         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('role',       sa.String(30), nullable=False),
        sa.Column('module',     sa.String(50), nullable=False),
        sa.Column('can_view',   sa.Boolean, server_default='false'),
        sa.Column('can_create', sa.Boolean, server_default='false'),
        sa.Column('can_edit',   sa.Boolean, server_default='false'),
        sa.Column('can_delete', sa.Boolean, server_default='false'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('role', 'module', name='uq_role_permissions_role_module'),
    )

    # ── notification_preferences ─────────────────────────────────────────────────
    op.create_table(
        'notification_preferences',
        sa.Column('id',                  postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id',             postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), unique=True, nullable=False),
        sa.Column('email_enabled',       sa.Boolean, server_default='true'),
        sa.Column('push_enabled',        sa.Boolean, server_default='true'),
        sa.Column('leave_updates',       sa.Boolean, server_default='true'),
        sa.Column('payroll_updates',     sa.Boolean, server_default='true'),
        sa.Column('task_assignments',    sa.Boolean, server_default='true'),
        sa.Column('attendance_alerts',   sa.Boolean, server_default='true'),
        sa.Column('system_announcements',sa.Boolean, server_default='true'),
        sa.Column('updated_at',          sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('notification_preferences')
    op.drop_table('role_permissions')
    op.drop_table('leave_policy')
    op.drop_table('attendance_config')
    op.drop_table('company_settings')
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.drop_table('expenses')
    op.drop_table('leave_balances')
    op.drop_table('payroll_entries')
