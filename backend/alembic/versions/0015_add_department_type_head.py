"""Add type and head_id columns to departments

Revision ID: 0015
Revises: 0014
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('departments', sa.Column('type', sa.String(20), server_default='Other', nullable=True))
    op.add_column('departments', sa.Column('head_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_departments_head_id', 'departments', 'users', ['head_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_departments_head_id', 'departments', type_='foreignkey')
    op.drop_column('departments', 'head_id')
    op.drop_column('departments', 'type')
