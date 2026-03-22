"""Add indexes for dashboard query performance.

Covers: attendance.date, leaves.status, sprints.status,
        attendance(date,status) composite for trend queries.

Revision ID: 0031
Revises: 0030
Create Date: 2026-03-21
"""
from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS to handle pre-existing indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_attendance_date ON attendance (date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_attendance_date_status ON attendance (date, status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_leaves_status ON leaves (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sprints_status ON sprints (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_projects_status ON projects (status)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_projects_status")
    op.execute("DROP INDEX IF EXISTS ix_sprints_status")
    op.execute("DROP INDEX IF EXISTS ix_leaves_status")
    op.execute("DROP INDEX IF EXISTS ix_attendance_date_status")
    op.execute("DROP INDEX IF EXISTS ix_attendance_date")
