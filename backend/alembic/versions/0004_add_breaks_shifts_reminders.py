"""add break tracking, shift management, and reminder notifications

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = '0004'
down_revision = '0003'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ── 1. Shifts table ──────────────────────────────────────────────────────────
    op.create_table(
        'shifts',
        sa.Column('id',             postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name',           sa.String(100),  nullable=False, unique=True),
        sa.Column('start_time',     sa.String(5),    nullable=False),
        sa.Column('end_time',       sa.String(5),    nullable=False),
        sa.Column('grace_minutes',  sa.Integer,      server_default='10'),
        sa.Column('is_night_shift', sa.Boolean,      server_default='false'),
        sa.Column('is_active',      sa.Boolean,      server_default='true'),
        sa.Column('created_at',     sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── 2. shift_id on users ─────────────────────────────────────────────────────
    op.add_column('users', sa.Column(
        'shift_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('shifts.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_users_shift_id', 'users', ['shift_id'])

    # ── 3. Break tracking columns on attendance ──────────────────────────────────
    op.add_column('attendance', sa.Column('break_start',   sa.Time, nullable=True))
    op.add_column('attendance', sa.Column('break_end',     sa.Time, nullable=True))
    op.add_column('attendance', sa.Column('break_minutes', sa.Numeric(6, 2), nullable=True))
    op.add_column('attendance', sa.Column('on_break',      sa.Boolean, server_default='false'))

    # ── 4. shift_id on attendance (historical record) ────────────────────────────
    op.add_column('attendance', sa.Column(
        'shift_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('shifts.id', ondelete='SET NULL'),
        nullable=True,
    ))

    # ── 5. WFH status value in attendancestatus enum ─────────────────────────────
    op.execute("ALTER TYPE attendancestatus ADD VALUE IF NOT EXISTS 'wfh'")

    # ── 6. Reminder times on attendance_config ───────────────────────────────────
    op.add_column('attendance_config', sa.Column(
        'checkin_reminder_time', sa.String(5), server_default="'09:00'"))
    op.add_column('attendance_config', sa.Column(
        'checkout_reminder_time', sa.String(5), server_default="'18:00'"))

    # ── 7. New notification type enum values ─────────────────────────────────────
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'checkin_reminder'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'checkout_reminder'")

    # ── 8. Reminder preference columns on notification_preferences ───────────────
    op.add_column('notification_preferences', sa.Column(
        'checkin_reminder_inapp', sa.Boolean, server_default='true'))
    op.add_column('notification_preferences', sa.Column(
        'checkout_reminder_inapp', sa.Boolean, server_default='true'))


def downgrade() -> None:
    op.drop_column('notification_preferences', 'checkout_reminder_inapp')
    op.drop_column('notification_preferences', 'checkin_reminder_inapp')
    op.drop_column('attendance_config', 'checkout_reminder_time')
    op.drop_column('attendance_config', 'checkin_reminder_time')
    op.drop_column('attendance', 'shift_id')
    op.drop_column('attendance', 'on_break')
    op.drop_column('attendance', 'break_minutes')
    op.drop_column('attendance', 'break_end')
    op.drop_column('attendance', 'break_start')
    op.drop_index('ix_users_shift_id', table_name='users')
    op.drop_column('users', 'shift_id')
    op.drop_table('shifts')
