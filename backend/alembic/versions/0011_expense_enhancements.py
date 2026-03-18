"""Expense enhancements: multi-currency, mileage, policies

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    # New columns on expenses
    op.add_column('expenses', sa.Column('currency', sa.String(3), server_default='INR'))
    op.add_column('expenses', sa.Column('exchange_rate', sa.Numeric(12, 6), server_default='1'))
    op.add_column('expenses', sa.Column('amount_inr', sa.Numeric(12, 2), nullable=True))
    op.add_column('expenses', sa.Column('mileage_km', sa.Numeric(8, 2), nullable=True))
    op.add_column('expenses', sa.Column('mileage_rate', sa.Numeric(6, 2), nullable=True))
    op.add_column('expenses', sa.Column('is_billable', sa.Boolean(), server_default='false'))
    op.add_column('expenses', sa.Column('merchant_name', sa.String(200), nullable=True))
    op.add_column('expenses', sa.Column('payment_method', sa.String(20), nullable=True))

    # Expense policies table
    op.create_table(
        'expense_policies',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('category', sa.String(20), nullable=True),
        sa.Column('max_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('requires_receipt', sa.Boolean(), server_default='true'),
        sa.Column('requires_approval', sa.Boolean(), server_default='true'),
        sa.Column('auto_approve_below', sa.Numeric(12, 2), nullable=True),
        sa.Column('mileage_rate_per_km', sa.Numeric(6, 2), server_default='8'),
        sa.Column('allowed_currencies', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('expense_policies')
    op.drop_column('expenses', 'payment_method')
    op.drop_column('expenses', 'merchant_name')
    op.drop_column('expenses', 'is_billable')
    op.drop_column('expenses', 'mileage_rate')
    op.drop_column('expenses', 'mileage_km')
    op.drop_column('expenses', 'amount_inr')
    op.drop_column('expenses', 'exchange_rate')
    op.drop_column('expenses', 'currency')
