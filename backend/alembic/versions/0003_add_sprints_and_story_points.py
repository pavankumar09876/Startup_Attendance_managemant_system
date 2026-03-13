"""add sprints table and story_points/sprint_id to tasks

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision      = '0003'
down_revision = '0002'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ── Add 'blocked' to the existing taskstatus enum ───────────────────────────
    op.execute("ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'blocked'")

    # ── sprints table ────────────────────────────────────────────────────────────
    op.create_table(
        'sprints',
        sa.Column('id',           postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id',   postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('projects.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('name',         sa.String(200), nullable=False),
        sa.Column('goal',         sa.Text,        nullable=True),
        sa.Column('status',
                  sa.Enum('planned', 'active', 'completed', name='sprintstatus'),
                  nullable=False, server_default='planned'),
        sa.Column('start_date',   sa.Date,                       nullable=True),
        sa.Column('end_date',     sa.Date,                       nullable=True),
        sa.Column('capacity',     sa.Integer,                    nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True),    nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )

    # Partial unique index — only one active sprint per project (DB-level enforcement)
    op.create_index(
        'ix_sprints_one_active_per_project',
        'sprints',
        ['project_id'],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    # ── tasks: sprint_id + story_points ─────────────────────────────────────────
    op.add_column('tasks', sa.Column(
        'sprint_id', postgresql.UUID(as_uuid=True),
        sa.ForeignKey('sprints.id', ondelete='SET NULL'),
        nullable=True,
    ))
    op.create_index('ix_tasks_sprint_id', 'tasks', ['sprint_id'])

    op.add_column('tasks', sa.Column('story_points', sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'story_points')
    op.drop_index('ix_tasks_sprint_id', table_name='tasks')
    op.drop_column('tasks', 'sprint_id')
    op.drop_index('ix_sprints_one_active_per_project', table_name='sprints')
    op.drop_table('sprints')
    op.execute("DROP TYPE IF EXISTS sprintstatus")
