"""Project enhancements: subtasks, dependencies, comments, recurring tasks

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    # Subtask support — parent_id on tasks
    op.add_column('tasks', sa.Column('parent_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_tasks_parent', 'tasks', 'tasks', ['parent_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_tasks_parent_id', 'tasks', ['parent_id'])

    # Task dependencies
    op.create_table(
        'task_dependencies',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('blocking_task_id', UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_task_dependencies_task_id', 'task_dependencies', ['task_id'])

    # Task comments
    op.create_table(
        'task_comments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', UUID(as_uuid=True), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_task_comments_task_id', 'task_comments', ['task_id'])

    # Recurring tasks
    op.create_table(
        'recurring_tasks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(20), server_default='medium'),
        sa.Column('assignee_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('recurrence_rule', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('last_created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('recurring_tasks')
    op.drop_index('ix_task_comments_task_id')
    op.drop_table('task_comments')
    op.drop_index('ix_task_dependencies_task_id')
    op.drop_table('task_dependencies')
    op.drop_index('ix_tasks_parent_id')
    op.drop_constraint('fk_tasks_parent', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'parent_id')
