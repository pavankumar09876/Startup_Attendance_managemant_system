"""add documents, revoked_tokens, manager_id

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision   = '0006'
down_revision = '0005'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ── documents ─────────────────────────────────────────────────────────────
    op.create_table(
        'documents',
        sa.Column('id',            postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id',   postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('document_type', sa.String(50),   nullable=False, server_default='other'),
        sa.Column('filename',      sa.String(300),  nullable=False),
        sa.Column('file_path',     sa.String(500),  nullable=False),
        sa.Column('notes',         sa.Text,         nullable=True),
        sa.Column('verified',      sa.Boolean,      nullable=False, server_default='false'),
        sa.Column('verified_by',   postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('verified_at',   sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_documents_employee_id', 'documents', ['employee_id'])

    # ── revoked_tokens ────────────────────────────────────────────────────────
    op.create_table(
        'revoked_tokens',
        sa.Column('id',         postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('jti',        sa.String(64),  nullable=False, unique=True),
        sa.Column('user_id',    sa.String(64),  nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_revoked_tokens_jti',     'revoked_tokens', ['jti'],     unique=True)
    op.create_index('ix_revoked_tokens_user_id', 'revoked_tokens', ['user_id'])

    # ── manager_id on users ───────────────────────────────────────────────────
    op.add_column('users', sa.Column(
        'manager_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('users', 'manager_id')
    op.drop_table('revoked_tokens')
    op.drop_table('documents')
