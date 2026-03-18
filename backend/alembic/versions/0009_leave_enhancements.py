"""Add leave enhancements: half-day, sandwich rule, comp-off, encashment, accrual

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    # --- leaves table ---
    op.add_column('leaves', sa.Column('is_half_day', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('leaves', sa.Column('half_day_period', sa.String(20), nullable=True))
    op.add_column('leaves', sa.Column('comp_off_date', sa.Date(), nullable=True))
    # Change total_days from Integer to Numeric(6,1) to support half-days
    op.alter_column('leaves', 'total_days',
                    existing_type=sa.Integer(),
                    type_=sa.Numeric(6, 1),
                    existing_nullable=False)

    # --- leave_policies table ---
    op.add_column('leave_policies', sa.Column('sandwich_rule', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('leave_policies', sa.Column('allow_half_day', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('leave_policies', sa.Column('allow_negative_balance', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('leave_policies', sa.Column('max_negative_days', sa.Numeric(4, 1), server_default='0', nullable=False))
    op.add_column('leave_policies', sa.Column('encashment_allowed', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('leave_policies', sa.Column('encashment_max_days', sa.Integer(), nullable=True))
    op.add_column('leave_policies', sa.Column('accrual_type', sa.String(20), server_default='yearly', nullable=False))
    op.add_column('leave_policies', sa.Column('monthly_accrual_amount', sa.Numeric(4, 1), nullable=True))
    op.add_column('leave_policies', sa.Column('probation_days_before_eligible', sa.Integer(), server_default='0', nullable=False))


def downgrade():
    op.drop_column('leave_policies', 'probation_days_before_eligible')
    op.drop_column('leave_policies', 'monthly_accrual_amount')
    op.drop_column('leave_policies', 'accrual_type')
    op.drop_column('leave_policies', 'encashment_max_days')
    op.drop_column('leave_policies', 'encashment_allowed')
    op.drop_column('leave_policies', 'max_negative_days')
    op.drop_column('leave_policies', 'allow_negative_balance')
    op.drop_column('leave_policies', 'allow_half_day')
    op.drop_column('leave_policies', 'sandwich_rule')

    op.alter_column('leaves', 'total_days',
                    existing_type=sa.Numeric(6, 1),
                    type_=sa.Integer(),
                    existing_nullable=False)
    op.drop_column('leaves', 'comp_off_date')
    op.drop_column('leaves', 'half_day_period')
    op.drop_column('leaves', 'is_half_day')
