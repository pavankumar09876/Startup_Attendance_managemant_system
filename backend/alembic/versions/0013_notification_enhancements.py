"""Add notification enhancements: category, actions, priority

Revision ID: 0013
Revises: 0012
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('notifications', sa.Column('category', sa.String(50), server_default='general', nullable=False))
    op.add_column('notifications', sa.Column('action_type', sa.String(50), nullable=True))
    op.add_column('notifications', sa.Column('action_entity_type', sa.String(50), nullable=True))
    op.add_column('notifications', sa.Column('action_entity_id', UUID(as_uuid=True), nullable=True))
    op.add_column('notifications', sa.Column('is_actioned', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('notifications', sa.Column('priority', sa.String(10), server_default='normal', nullable=False))
    op.add_column('notifications', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    # Index for category + unread queries
    op.create_index('ix_notifications_category', 'notifications', ['category'])


def downgrade():
    op.drop_index('ix_notifications_category')
    op.drop_column('notifications', 'expires_at')
    op.drop_column('notifications', 'priority')
    op.drop_column('notifications', 'is_actioned')
    op.drop_column('notifications', 'action_entity_id')
    op.drop_column('notifications', 'action_entity_type')
    op.drop_column('notifications', 'action_type')
    op.drop_column('notifications', 'category')
