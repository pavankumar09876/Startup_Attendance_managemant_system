"""add issue_type to tasks

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    # Create the enum type in Postgres
    issuetype_enum = sa.Enum('task', 'bug', 'story', 'epic', name='issuetype')
    issuetype_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'tasks',
        sa.Column(
            'issue_type',
            sa.Enum('task', 'bug', 'story', 'epic', name='issuetype'),
            nullable=False,
            server_default='task',
        ),
    )


def downgrade():
    op.drop_column('tasks', 'issue_type')
    sa.Enum(name='issuetype').drop(op.get_bind(), checkfirst=True)
