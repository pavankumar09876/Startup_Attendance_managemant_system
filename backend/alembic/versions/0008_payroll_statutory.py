"""Add statutory payroll columns: EPF employer, ESI employer, PT, tax regime

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('payroll_entries', sa.Column('pf_employer', sa.Numeric(12, 2), server_default='0'))
    op.add_column('payroll_entries', sa.Column('esi_employer', sa.Numeric(12, 2), server_default='0'))
    op.add_column('payroll_entries', sa.Column('professional_tax', sa.Numeric(12, 2), server_default='0'))
    op.add_column('payroll_entries', sa.Column('tax_regime', sa.String(10), server_default='new'))


def downgrade():
    op.drop_column('payroll_entries', 'tax_regime')
    op.drop_column('payroll_entries', 'professional_tax')
    op.drop_column('payroll_entries', 'esi_employer')
    op.drop_column('payroll_entries', 'pf_employer')
