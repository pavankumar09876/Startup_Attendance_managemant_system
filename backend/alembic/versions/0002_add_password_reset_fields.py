"""add must_change_password and password_reset fields to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'must_change_password', sa.Boolean(), nullable=False, server_default='false'
    ))
    op.add_column('users', sa.Column(
        'password_reset_token', sa.String(255), nullable=True
    ))
    op.add_column('users', sa.Column(
        'password_reset_expires_at', sa.DateTime(timezone=True), nullable=True
    ))
    op.create_index(
        'ix_users_password_reset_token',
        'users',
        ['password_reset_token'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_users_password_reset_token', table_name='users')
    op.drop_column('users', 'password_reset_expires_at')
    op.drop_column('users', 'password_reset_token')
    op.drop_column('users', 'must_change_password')
