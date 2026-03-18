"""Add extra user fields: hra, allowances, bank_account, ifsc_code, date_of_birth, address, emergency_contact, employment_type, work_location

Revision ID: 0016
Revises: 0015
"""
from alembic import op
import sqlalchemy as sa

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('hra', sa.Numeric(12, 2), nullable=True))
    op.add_column('users', sa.Column('allowances', sa.Numeric(12, 2), nullable=True))
    op.add_column('users', sa.Column('bank_account', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('ifsc_code', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('emergency_contact', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('employment_type', sa.String(20), nullable=True, server_default='full_time'))
    op.add_column('users', sa.Column('work_location', sa.String(20), nullable=True, server_default='office'))


def downgrade():
    op.drop_column('users', 'work_location')
    op.drop_column('users', 'employment_type')
    op.drop_column('users', 'emergency_contact')
    op.drop_column('users', 'address')
    op.drop_column('users', 'date_of_birth')
    op.drop_column('users', 'ifsc_code')
    op.drop_column('users', 'bank_account')
    op.drop_column('users', 'allowances')
    op.drop_column('users', 'hra')
