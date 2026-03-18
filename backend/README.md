# Workforce Pro — Backend

FastAPI REST API with async SQLAlchemy, PostgreSQL, and JWT authentication.

## Tech Stack

- **Framework:** FastAPI 0.115.0
- **ORM:** SQLAlchemy 2.0.35 (async with asyncpg)
- **Database:** PostgreSQL 16
- **Migrations:** Alembic 1.13.3
- **Auth:** JWT (python-jose) + bcrypt + MFA (pyotp)
- **Scheduler:** APScheduler 3.10.4
- **Validation:** Pydantic v2
- **Rate Limiting:** slowapi
- **PDF Generation:** ReportLab

## Setup

```bash
# Create virtual environment
python -m venv ../attendence_venv
source ../attendence_venv/bin/activate   # Windows: ..\attendence_venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, SECRET_KEY

# Run migrations
alembic upgrade head

# Seed default users
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # App entry point, lifespan, middleware
│   ├── config.py            # Pydantic settings (env vars)
│   ├── database.py          # AsyncSession factory, engine
│   │
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── user.py          # User, Department, Role enum
│   │   ├── attendance.py    # Attendance, Break, Regularization
│   │   ├── leave.py         # LeaveRequest, LeaveBalance, Holiday
│   │   ├── project.py       # Project, Task, Sprint, project_members
│   │   ├── payroll.py       # PayrollRun, Payslip, Expense
│   │   ├── notification.py  # Notification
│   │   ├── settings.py      # CompanySettings, AttendanceSettings
│   │   ├── shift.py         # Shift, ShiftAssignment
│   │   ├── document.py      # EmployeeDocument
│   │   ├── session.py       # UserSession (MFA)
│   │   └── revoked_token.py # RevokedToken (JWT blacklist)
│   │
│   ├── routers/             # API endpoint handlers
│   │   ├── auth.py          # Login, refresh, password reset, logout
│   │   ├── users.py         # User CRUD, departments, search
│   │   ├── attendance.py    # Clock in/out, team view, export CSV
│   │   ├── leave.py         # Apply, approve/reject, balances, holidays
│   │   ├── projects.py      # Project CRUD, members
│   │   ├── tasks_global.py  # Cross-project task management
│   │   ├── sprints.py       # Sprint CRUD, complete sprint
│   │   ├── payroll.py       # Run payroll, payslips, PDF download
│   │   ├── expenses.py      # Submit, approve, reject expenses
│   │   ├── dashboard.py     # Role-specific dashboard data
│   │   ├── reports.py       # Attendance, payroll, project reports
│   │   ├── settings_router.py  # Company & system settings
│   │   ├── notifications_router.py  # Notification list, mark read
│   │   ├── shifts.py        # Shift management & assignment
│   │   ├── documents.py     # Document upload/download
│   │   ├── mfa.py           # TOTP setup, verify, disable
│   │   └── audit.py         # Audit log viewer
│   │
│   ├── schemas/             # Pydantic request/response models
│   │   ├── user.py          # UserCreate, UserUpdate, UserOut, TokenOut
│   │   ├── attendance.py    # AttendanceOut, TeamAttendance, Regularization
│   │   ├── leave.py         # LeaveRequest, LeaveBalance, Holiday
│   │   ├── project.py       # ProjectCreate, TaskCreate, SprintOut
│   │   ├── payroll.py       # PayslipOut, RunPayroll, ExpenseOut
│   │   ├── notification.py  # NotificationOut
│   │   ├── settings.py      # CompanySettings, AttendanceSettings
│   │   └── shift.py         # ShiftCreate, ShiftOut
│   │
│   ├── services/            # Business logic & background jobs
│   │   ├── leave_engine.py         # Leave balance calculations
│   │   ├── expense_engine.py       # Expense processing rules
│   │   ├── statutory.py            # PF, ESI, TDS calculations
│   │   ├── notification_service.py # Create & send notifications
│   │   ├── mfa.py                  # TOTP generation & verification
│   │   ├── reminder_cron.py        # Clock-in/out reminders (every min)
│   │   ├── absent_cron.py          # Auto-mark absent (every min, time-gated)
│   │   └── carry_forward_cron.py   # Yearly leave carry-forward (Jan 1)
│   │
│   └── utils/
│       ├── dependencies.py  # get_current_user, require_roles
│       ├── security.py      # JWT encode/decode, password hashing
│       └── email.py         # SMTP email sending
│
├── alembic/                 # Database migrations
│   ├── env.py
│   └── versions/            # 18 migration files (0001–0018)
│
├── tests/                   # Integration tests
│   ├── conftest.py          # Shared fixtures
│   ├── test_auth.py
│   ├── test_employee.py     # 12 tests — full employee CRUD
│   ├── test_attendance.py
│   └── test_leave.py
│
├── uploads/                 # User-uploaded files (gitignored)
├── seed.py                  # Database seeder (default users)
├── requirements.txt         # Production dependencies
├── requirements-dev.txt     # Dev/test dependencies
├── pytest.ini               # Pytest config (asyncio_mode = auto)
├── alembic.ini              # Alembic config
├── Dockerfile
├── .env.example
└── .env                     # Local environment (gitignored)
```

## API Endpoints

### Auth (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Login with email/password |
| POST | `/refresh` | Refresh access token |
| POST | `/logout` | Revoke tokens |
| POST | `/forgot-password` | Send reset email |
| POST | `/reset-password` | Reset with token |
| POST | `/set-password` | Forced first-login change |
| POST | `/change-password` | Change own password |

### Users (`/api/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List users (paginated, filterable) |
| POST | `/` | Create user |
| GET | `/{id}` | Get user by ID |
| PATCH | `/{id}` | Update user |
| DELETE | `/{id}` | Delete user |
| GET | `/departments` | List departments |
| POST | `/departments` | Create department |
| PATCH | `/departments/{id}` | Update department |
| DELETE | `/departments/{id}` | Delete department |

### Attendance (`/api/attendance`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/check-in` | Clock in |
| POST | `/check-out` | Clock out |
| GET | `/my` | Own attendance history |
| GET | `/team` | Team attendance (manager/admin) |
| GET | `/export` | Export CSV |
| POST | `/regularize` | Submit regularization |
| PATCH | `/regularize/{id}` | Approve/reject regularization |

### Leave (`/api/leave`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/apply` | Apply for leave |
| GET | `/my` | Own leave requests |
| GET | `/approvals` | Pending approvals |
| PATCH | `/{id}/approve` | Approve leave |
| PATCH | `/{id}/reject` | Reject leave |
| GET | `/balances` | Leave balances |
| GET | `/holidays` | Holiday list |

### Projects (`/api/projects`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List projects (paginated) |
| POST | `/` | Create project |
| GET | `/{id}` | Get project detail |
| PATCH | `/{id}` | Update project |
| DELETE | `/{id}` | Delete project |
| GET | `/{id}/tasks` | List project tasks |
| POST | `/{id}/tasks` | Create task |
| PATCH | `/tasks/{id}` | Update task |
| DELETE | `/tasks/{id}` | Delete task |

### Payroll (`/api/payroll`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/run` | Run payroll for month |
| GET | `/payslips` | List payslips |
| GET | `/payslips/{id}/pdf` | Download payslip PDF |

### Other Routers
- `/api/tasks` — Global task management (Kanban)
- `/api/sprints` — Sprint CRUD & completion
- `/api/expenses` — Expense submit/approve/reject
- `/api/dashboard` — Role-specific dashboard aggregation
- `/api/reports` — Generate & schedule reports
- `/api/settings` — Company, attendance, leave settings
- `/api/notifications` — List & mark-read notifications
- `/api/shifts` — Shift management & assignment
- `/api/documents` — Document upload/download
- `/api/mfa` — TOTP setup/verify/disable
- `/api/audit` — Audit log viewer

### Special Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (DB status) |
| GET | `/api/search?q=` | Global search (employees, projects, tasks) |
| GET | `/api/files/{path}` | Protected file serving |

## Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply all pending migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1

# View current revision
alembic current
```

## Background Jobs

Three APScheduler cron jobs run on app startup:

| Job | Schedule | Description |
|-----|----------|-------------|
| Reminder | Every minute | Clock-in/out reminders (time-gated) |
| Auto-absent | Every minute | Mark absent after work hours (time-gated) |
| Carry-forward | Jan 1, 00:05 | Carry forward unused leave balances |

## Testing

```bash
pip install -r requirements-dev.txt
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest tests/test_employee.py  # Run specific test file
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL async connection string |
| `SECRET_KEY` | Yes | JWT signing key (min 32 chars for prod) |
| `ALLOWED_ORIGINS` | No | CORS origins (default: localhost) |
| `REDIS_URL` | No | Redis connection string |
| `ENV` | No | `development` or `production` |
| `SMTP_HOST` | No | Email server host |
| `SMTP_PORT` | No | Email server port |
| `SMTP_USER` | No | Email username |
| `SMTP_PASS` | No | Email password |
| `EMAIL_FROM` | No | Sender address |
