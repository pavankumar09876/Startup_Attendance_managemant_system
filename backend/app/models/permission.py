"""
Granular permission system.

Each Permission is an action string like "employee:create", "leave:approve".
DefaultRolePermission maps roles to their default permissions.
The RolePermission table in settings.py handles module-level UI toggles;
this model handles API-level enforcement.
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Permission(Base):
    """Individual permission — e.g. 'employee:create', 'payroll:finalize'."""
    __tablename__ = "permissions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code        = Column(String(100), unique=True, nullable=False, index=True)  # e.g. "employee:create"
    module      = Column(String(50), nullable=False)   # e.g. "staff"
    action      = Column(String(50), nullable=False)   # e.g. "create"
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class DefaultRolePermission(Base):
    """Maps a role to a permission code. Seeded on deploy."""
    __tablename__ = "default_role_permissions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role            = Column(String(50), nullable=False, index=True)   # e.g. "admin"
    permission_code = Column(String(100), nullable=False, index=True)  # e.g. "employee:create"

    __table_args__ = (
        # Prevent duplicates
        {"sqlite_autoincrement": False},
    )


class CustomRole(Base):
    """User-defined custom roles with assignable permission sets."""
    __tablename__ = "custom_roles"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(Text, nullable=False, default="[]")  # JSON array of permission codes
    is_active   = Column(Boolean, default=True)
    created_by  = Column(UUID(as_uuid=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


# ── Canonical permission codes ──────────────────────────────────────────────
# These are used by require_permission() and seeded into the DB.

PERMISSIONS = {
    # Staff
    "employee:view":       ("staff", "view",    "View employee list"),
    "employee:view_all":   ("staff", "view_all","View all employees (not just team)"),
    "employee:create":     ("staff", "create",  "Create new employee"),
    "employee:update":     ("staff", "update",  "Update employee details"),
    "employee:delete":     ("staff", "delete",  "Delete (deactivate) employee"),
    "department:manage":   ("staff", "manage",  "Create/edit/delete departments"),

    # Attendance
    "attendance:checkin":        ("attendance", "checkin",  "Clock in/out (self)"),
    "attendance:view_own":       ("attendance", "view",     "View own attendance"),
    "attendance:view_team":      ("attendance", "view_team","View team attendance"),
    "attendance:view_all":       ("attendance", "view_all", "View all attendance"),
    "attendance:create":         ("attendance", "create",   "Manually create attendance record"),
    "attendance:update":         ("attendance", "update",   "Edit attendance records"),
    "attendance:export":         ("attendance", "export",   "Export attendance CSV"),
    "attendance:approve_regularization": ("attendance", "approve", "Approve regularization requests"),

    # Leave
    "leave:apply":         ("leave", "apply",    "Apply for own leave"),
    "leave:view_own":      ("leave", "view",     "View own leave history"),
    "leave:view_team":     ("leave", "view_team","View team leave requests"),
    "leave:view_all":      ("leave", "view_all", "View all leave requests"),
    "leave:approve":       ("leave", "approve",  "Approve/reject leave requests"),
    "leave:manage_holidays": ("leave", "manage", "Manage holidays"),
    "leave:manage_policies": ("leave", "manage", "Manage leave policies"),

    # Projects
    "project:view":        ("projects", "view",   "View projects"),
    "project:create":      ("projects", "create", "Create project"),
    "project:update":      ("projects", "update", "Update project"),
    "project:delete":      ("projects", "delete", "Delete project"),
    "task:create":         ("projects", "create", "Create task"),
    "task:update":         ("projects", "update", "Update task"),
    "task:delete":         ("projects", "delete", "Delete task"),

    # Payroll
    "payroll:view_own":    ("payroll", "view",     "View own payslips"),
    "payroll:view_all":    ("payroll", "view_all", "View all payroll data"),
    "payroll:run":         ("payroll", "run",      "Run payroll (prepare)"),
    "payroll:finalize":    ("payroll", "finalize", "Finalize payroll (mark paid)"),
    "payroll:manage_balances": ("payroll", "manage", "Allocate leave balances"),

    # Expenses
    "expense:submit":      ("expenses", "submit",  "Submit expense claim"),
    "expense:view_own":    ("expenses", "view",     "View own expenses"),
    "expense:view_all":    ("expenses", "view_all", "View all expenses"),
    "expense:approve":     ("expenses", "approve",  "Approve/reject expenses"),
    "expense:manage_policies": ("expenses", "manage", "Manage expense policies"),

    # Reports
    "report:attendance":   ("reports", "view",    "View attendance reports"),
    "report:payroll":      ("reports", "view",    "View payroll reports"),
    "report:project":      ("reports", "view",    "View project reports"),
    "report:team":         ("reports", "view",    "View team reports"),
    "report:financial":    ("reports", "view",    "View financial/payroll analytics"),
    "report:workforce":    ("reports", "view",    "View workforce demographics"),

    # Settings
    "settings:company":    ("settings", "manage", "Manage company settings"),
    "settings:attendance": ("settings", "manage", "Manage attendance config"),
    "settings:leave":      ("settings", "manage", "Manage leave settings"),
    "settings:notifications": ("settings", "manage", "Manage notification prefs"),
    "settings:roles":      ("settings", "manage", "Manage role permissions"),
    "settings:shifts":     ("settings", "manage", "Manage shifts"),

    # Dashboard
    "dashboard:admin":     ("dashboard", "view", "View admin dashboard"),
    "dashboard:manager":   ("dashboard", "view", "View manager dashboard"),
    "dashboard:employee":  ("dashboard", "view", "View employee dashboard"),

    # Documents
    "document:upload":     ("documents", "upload",  "Upload employee documents"),
    "document:view":       ("documents", "view",    "View documents"),

    # MFA / Auth
    "mfa:manage":          ("auth", "manage", "Setup/disable MFA"),

    # Audit
    "audit:view":          ("audit", "view", "View audit logs"),
}


# ── Default role → permission mapping ───────────────────────────────────────
# Which permissions each role gets by default.

ROLE_PERMISSIONS = {
    "super_admin": list(PERMISSIONS.keys()),  # Everything

    "admin": [
        # Staff
        "employee:view", "employee:view_all", "employee:create", "employee:update", "employee:delete",
        "department:manage",
        # Attendance
        "attendance:checkin", "attendance:view_own", "attendance:view_all",
        "attendance:create", "attendance:update", "attendance:export",
        "attendance:approve_regularization",
        # Leave
        "leave:apply", "leave:view_own", "leave:view_all", "leave:approve",
        "leave:manage_holidays", "leave:manage_policies",
        # Projects
        "project:view", "project:create", "project:update", "project:delete",
        "task:create", "task:update", "task:delete",
        # Payroll — admin can finalize but HR prepares
        "payroll:view_own", "payroll:view_all", "payroll:finalize", "payroll:manage_balances",
        # Expenses
        "expense:submit", "expense:view_own", "expense:view_all", "expense:approve",
        "expense:manage_policies",
        # Reports — all reports
        "report:attendance", "report:payroll", "report:project", "report:team",
        "report:financial", "report:workforce",
        # Settings — company level
        "settings:company", "settings:attendance", "settings:leave",
        "settings:notifications", "settings:roles", "settings:shifts",
        # Dashboard
        "dashboard:admin",
        # Documents, MFA, Audit
        "document:upload", "document:view", "mfa:manage", "audit:view",
    ],

    "hr": [
        # Staff
        "employee:view", "employee:view_all", "employee:create", "employee:update",
        "department:manage",
        # Attendance
        "attendance:checkin", "attendance:view_own", "attendance:view_all",
        "attendance:create", "attendance:update", "attendance:export",
        "attendance:approve_regularization",
        # Leave
        "leave:apply", "leave:view_own", "leave:view_all", "leave:approve",
        "leave:manage_holidays", "leave:manage_policies",
        # Projects — HR has NO project management
        "project:view",
        # Payroll — HR can RUN payroll but NOT finalize
        "payroll:view_own", "payroll:view_all", "payroll:run", "payroll:manage_balances",
        # Expenses
        "expense:submit", "expense:view_own", "expense:view_all", "expense:approve",
        # Reports — people reports only, NOT financial
        "report:attendance", "report:team", "report:workforce",
        # Settings — HR configs only, NOT company
        "settings:attendance", "settings:leave", "settings:notifications", "settings:shifts",
        # Dashboard
        "dashboard:admin",
        # Documents, MFA
        "document:upload", "document:view", "mfa:manage",
    ],

    "manager": [
        # Staff — team only (scoped by scope_query)
        "employee:view",
        # Attendance — team only
        "attendance:checkin", "attendance:view_own", "attendance:view_team",
        "attendance:export", "attendance:approve_regularization",
        # Leave — team only
        "leave:apply", "leave:view_own", "leave:view_team", "leave:approve",
        # Projects — can manage projects
        "project:view", "project:create", "project:update",
        "task:create", "task:update", "task:delete",
        # Payroll — own only
        "payroll:view_own",
        # Expenses — can approve team expenses
        "expense:submit", "expense:view_own", "expense:approve",
        # Reports — team reports only
        "report:team",
        # Dashboard
        "dashboard:manager",
        # MFA
        "mfa:manage",
    ],

    "employee": [
        # Staff — self only (scoped)
        "employee:view",
        # Attendance — self only
        "attendance:checkin", "attendance:view_own",
        # Leave — self only
        "leave:apply", "leave:view_own",
        # Projects — view + task operations
        "project:view",
        "task:create", "task:update",
        # Payroll — own only
        "payroll:view_own",
        # Expenses — own only
        "expense:submit", "expense:view_own",
        # Dashboard
        "dashboard:employee",
        # MFA
        "mfa:manage",
    ],
}
