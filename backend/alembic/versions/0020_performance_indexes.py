"""Performance indexes for frequently queried columns.

Revision ID: 0020
Revises: 0019
Create Date: 2026-03-18
"""
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None

# (index_name, table_name, columns)
INDEXES = [
    # ── Attendance ─────────────────────────────────────────────────────────
    ("ix_attendance_emp_date",    "attendance",       ["employee_id", "date"]),
    ("ix_attendance_date_status", "attendance",       ["date", "status"]),
    ("ix_attendance_date",        "attendance",       ["date"]),

    # ── Leave ──────────────────────────────────────────────────────────────
    ("ix_leave_emp_status",       "leaves",           ["employee_id", "status"]),
    ("ix_leave_status",           "leaves",           ["status"]),
    ("ix_leave_start_date",       "leaves",           ["start_date"]),

    # ── Payroll ────────────────────────────────────────────────────────────
    ("ix_payroll_month_year",     "payroll_entries",  ["month", "year"]),
    ("ix_payroll_emp",            "payroll_entries",  ["employee_id"]),
    ("ix_payroll_status",         "payroll_entries",  ["status"]),

    # ── Tasks ──────────────────────────────────────────────────────────────
    ("ix_task_assignee_status",   "tasks",            ["assignee_id", "status"]),
    ("ix_task_project_status",    "tasks",            ["project_id", "status"]),
    ("ix_task_sprint",            "tasks",            ["sprint_id"]),

    # ── Notifications ──────────────────────────────────────────────────────
    ("ix_notification_user_read",    "notifications", ["user_id", "is_read"]),
    ("ix_notification_user_created", "notifications", ["user_id", "created_at"]),

    # ── Users ──────────────────────────────────────────────────────────────
    ("ix_user_manager",           "users",            ["manager_id"]),
    ("ix_user_department",        "users",            ["department_id"]),
    ("ix_user_active",            "users",            ["is_active"]),

    # ── Audit Logs ─────────────────────────────────────────────────────────
    ("ix_audit_actor",            "audit_logs",       ["actor_id"]),
    ("ix_audit_entity",           "audit_logs",       ["entity_type", "entity_id"]),

    # ── Leave Balances ─────────────────────────────────────────────────────
    ("ix_leavebalance_emp_year",  "leave_balances",   ["employee_id", "year"]),
]


def upgrade() -> None:
    for ix_name, table, columns in INDEXES:
        try:
            op.create_index(ix_name, table, columns, if_not_exists=True)
        except Exception:
            pass  # index may already exist from a model-level `index=True`


def downgrade() -> None:
    for ix_name, table, _columns in reversed(INDEXES):
        try:
            op.drop_index(ix_name, table_name=table)
        except Exception:
            pass  # index may not exist
