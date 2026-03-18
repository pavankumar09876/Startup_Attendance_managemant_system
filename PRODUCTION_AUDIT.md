# Production Readiness Audit — Workforce Pro

> **Audit Date:** 2026-03-14
> **Stack:** FastAPI + SQLAlchemy (async) + PostgreSQL · React 18 + Zustand + React Query
> **Auditor:** Claude Code (claude-sonnet-4-6)

---

## Table of Contents

1. [Architecture Review](#1-architecture-review)
2. [Critical Bugs](#2-critical-bugs)
3. [Security Issues](#3-security-issues)
4. [Data Integrity & Data Leaks](#4-data-integrity--data-leaks)
5. [Performance Bottlenecks](#5-performance-bottlenecks)
6. [Code Quality Problems](#6-code-quality-problems)
7. [Production Risks](#7-production-risks)
8. [Feature Gaps](#8-feature-gaps)
9. [Priority Fix List](#9-priority-fix-list)

---

## 1. Architecture Review

### Overview

FastAPI async backend with SQLAlchemy + asyncpg on PostgreSQL. React 18 frontend with Zustand + React Query. APScheduler for background jobs. JWT auth with DB-based revocation. Role-based access (5 levels: super_admin, admin, hr, manager, employee).

### Architectural Problems

| Issue | Detail |
|---|---|
| **No service layer** | All business logic lives directly in router functions (`payroll.py`, `dashboard.py`). Fat routers will become unmaintainable. |
| **Cron jobs bypass application session** | `absent_cron.py` and `carry_forward_cron.py` each create their own engine+session pool from scratch every invocation instead of reusing the app engine. |
| **Business logic in PDF endpoint** | `download_payslip_pdf` is 100+ lines of PDF layout code inside a router handler. |
| **Dual-engine problem in cron** | Two cron workers (`run_reminders`, `run_auto_absent`) fire every minute, each creating and destroying a DB engine pool. 3 workers × 1440 minutes/day = 4320 engine create/dispose cycles per day. |
| **No multi-worker awareness** | APScheduler runs in every Gunicorn worker process. With `-w 4`, all 4 processes will each mark employees absent independently, causing duplicate attendance records. |

---

## 2. Critical Bugs

### Bug 1 — `PATCH /users/{user_id}` has no role restriction

**Severity:** Critical
**File:** `backend/app/routers/users.py:133–150`

Any authenticated employee can call `PATCH /api/users/{any_uuid}` and modify any user's `role`, `salary`, `department_id`, or any other field in `UserUpdate`. There is only `get_current_user`, no `require_roles`.

```python
# Current (broken): any logged-in user can update anyone
current_user: User = Depends(get_current_user),

# Fix: add role guard + field whitelist for employees
if current_user.role == Role.EMPLOYEE and str(user_id) != str(current_user.id):
    raise HTTPException(403, "Forbidden")
if current_user.role == Role.EMPLOYEE:
    # strip privileged fields (role, salary, department_id) from payload
    payload = payload.model_copy(update={"role": None, "salary": None})
```

---

### Bug 2 — `logout-all` does NOT invalidate other sessions

**Severity:** High
**File:** `backend/app/routers/auth.py:148–172`

The endpoint comment literally reads *"For now just revoke current token + note in response"*. Other sessions are never revoked. The **"Sign out all other devices"** button in the UI is non-functional.

**Fix:** Add a `revoked_all_before` timestamp column on `User`, set it to `now()` on logout-all, and check it in `get_current_user` alongside the jti check.

```python
# In get_current_user — add after jti check:
token_iat = payload.get("iat")
if user.revoked_all_before and token_iat:
    if datetime.fromtimestamp(token_iat, tz=timezone.utc) < user.revoked_all_before:
        raise HTTPException(401, "Session invalidated. Please log in again.")
```

---

### Bug 3 — Route conflict: `/users/org-chart` unreachable

**Severity:** High
**File:** `backend/app/routers/users.py:120–189`

`GET /users/{user_id}` (line 120) is declared **before** `GET /users/org-chart` (line 168). In FastAPI/Starlette, since `"org-chart"` is not a valid `uuid.UUID`, the request returns **422 Unprocessable Entity** instead of falling through to the org-chart handler. The org-chart endpoint is dead.

**Fix:** Move `GET /users/org-chart` **before** `GET /users/{user_id}`.

---

### Bug 4 — Check-in lateness uses UTC time, shifts use local time

**Severity:** High
**File:** `backend/app/routers/attendance.py:103–111`

```python
now = datetime.now(timezone.utc).time().replace(tzinfo=None)  # UTC!
cutoff_h, cutoff_m = await _get_shift_cutoff(...)              # local time
is_late = now.hour > cutoff_h ...  # comparing UTC to IST — 5.5h off
```

An employee checking in at 9:00 IST is actually 03:30 UTC, so `cutoff_h=9` is never exceeded and no one is ever marked late.

**Fix:**
```python
from zoneinfo import ZoneInfo
tz = company_tz  # fetch from CompanySettings
now = datetime.now(ZoneInfo(tz)).time().replace(tzinfo=None)
```

---

### Bug 5 — Leave approval never updates LeaveBalance

**Severity:** High
**File:** `backend/app/routers/leave.py:61–105`

When a leave is `APPROVED`, `used_days` and `pending_days` on `LeaveBalance` are never updated. The leave balance displayed to employees will always show the original allocated amount regardless of approved leaves taken.

**Fix:** On approval: `balance.used_days += leave.total_days; balance.pending_days -= leave.total_days`. On application: `balance.pending_days += leave.total_days`. On rejection/cancel: `balance.pending_days -= leave.total_days`.

---

### Bug 6 — Payroll run ignores actual leave-of-pay data

**Severity:** High
**File:** `backend/app/routers/payroll.py:147–148`

```python
entry = _calculate_entry(emp, payload.month, payload.year)  # lop_days always 0!
```

`_calculate_entry` defaults `lop_days=0`. `run_payroll` never queries actual leave records for the period. Everyone always gets paid in full regardless of unpaid leaves.

**Fix:** Before calling `_calculate_entry`, query `Leave` for the employee+month with `leave_type="unpaid"` and `status=APPROVED` and pass the total days.

---

### Bug 7 — `database.py` commits on every GET request

**Severity:** Medium
**File:** `backend/app/database.py:26–35`

```python
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
        await session.commit()  # commits even on read-only GET requests
```

This runs a `COMMIT` on every request even when nothing was written, adding unnecessary DB roundtrips. It also silently persists any accidental mutation in a GET handler.

---

### Bug 8 — N+1 queries in sprint velocity

**Severity:** Medium
**File:** `backend/app/routers/dashboard.py:168–186`

```python
for sp in reversed(completed_sprints):  # up to 6 sprints
    done_pts = (await db.execute(
        select(func.sum(Task.story_points)).where(...)  # 1 query per sprint
    )).scalar()
```

6 individual queries instead of one grouped query.

**Fix:**
```python
velocity_rows = (await db.execute(
    select(Task.sprint_id, func.sum(Task.story_points))
    .where(Task.sprint_id.in_([s.id for s in completed_sprints]),
           Task.status == TaskStatus.DONE)
    .group_by(Task.sprint_id)
)).all()
pts_map = {str(r[0]): int(r[1] or 0) for r in velocity_rows}
```

---

### Bug 9 — `reset_password` timezone comparison is wrong

**Severity:** Medium
**File:** `backend/app/routers/auth.py:115–117`

```python
expires = user.password_reset_expires_at
if expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
```

If `expires` is already timezone-aware (it is — stored with `timezone=True`), `replace(tzinfo=...)` does **not** convert the time — it just overwrites the tzinfo tag. The comparison will be wrong by the server timezone offset.

**Fix:** `expires.astimezone(timezone.utc)` instead of `expires.replace(tzinfo=timezone.utc)`.

---

### Bug 10 — Dashboard queries pass UUID strings to UUID columns

**Severity:** Medium
**File:** `backend/app/routers/dashboard.py:109–111`

```python
absent_emp_ids = [str(a.employee_id) for a in absent_att]  # strings
select(User).where(User.id.in_(absent_emp_ids))             # UUID column vs strings
```

**Fix:** Keep as UUID objects: `absent_emp_ids = [a.employee_id for a in absent_att]`.

---

### Bug 11 — `emp.department` in PDF renders as ORM object, not string

**Severity:** Medium
**File:** `backend/app/routers/payroll.py:371`

```python
dept = emp.department or "—"  # emp.department is a Department ORM object!
```

This will print `<Department object at 0x...>` in the generated PDF.

**Fix:** `dept = emp.department.name if emp.department else "—"`

---

## 3. Security Issues

### CRITICAL — Secret key has insecure default value

**File:** `backend/app/config.py:15`

```python
SECRET_KEY: str = "your-secret-key-change-in-production"
```

If `.env` is absent or the variable is unset, all tokens are signed with this public default. The app starts successfully without a real secret.

**Fix:** Add a startup validator:
```python
@field_validator('SECRET_KEY')
def key_must_be_random(cls, v):
    if 'change' in v.lower() or len(v) < 32:
        raise ValueError('SECRET_KEY must be a random 32+ character value')
    return v
```

---

### CRITICAL — `DEBUG=True` in `.env`

**File:** `backend/.env:4`

With `DEBUG=True`, SQLAlchemy echoes every query — including `SELECT ... hashed_password ...` and salary figures — to stdout. In production, this leaks password hashes and PII to server logs.

**Fix:** `DEBUG=False` in production. Never commit `.env` with `DEBUG=True`.

---

### HIGH — No file type or size validation on uploads

**Files:** `backend/app/routers/documents.py:68–73`, `backend/app/routers/attendance.py:282–288`

- No MIME type check — attacker can upload `.php`, `.html`, `.exe`, or any file
- No file size limit — DoS via large file uploads
- Extension taken from user-controlled `file.filename` without validation

**Fix:**
```python
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ext = os.path.splitext(file.filename or '')[1].lower()
if ext not in ALLOWED_EXTENSIONS:
    raise HTTPException(400, f"File type not allowed. Allowed: {ALLOWED_EXTENSIONS}")
content = await file.read()
if len(content) > MAX_FILE_SIZE:
    raise HTTPException(413, "File too large. Maximum size is 10MB.")
```

---

### HIGH — Any authenticated user can enumerate all employees via search

**File:** `backend/app/main.py:86–148`

`GET /api/search` returns employee names, emails, and designations to **any** authenticated user including the EMPLOYEE role. An employee can enumerate the entire staff directory via the Ctrl+K search.

**Fix:** For EMPLOYEE role, restrict search results to own data or public-safe fields only.

---

### HIGH — No rate limiting on authentication endpoints

**File:** `backend/app/routers/auth.py:25–39`

No brute-force protection on `/auth/login` or `/auth/forgot-password`. An attacker can try unlimited passwords or trigger unlimited password reset emails.

**Fix:** Add `slowapi` rate limiter:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("10/minute")
async def login(...):
```

---

### HIGH — Uploaded files served without authorization

**File:** `backend/app/main.py:60`

```python
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
```

Anyone (unauthenticated) can download any uploaded document, ID proof, offer letter, or selfie by guessing or constructing the filename. Files are served publicly with no auth check.

**Fix:** Remove the public `StaticFiles` mount and serve files through a protected endpoint that verifies the requester has permission to access the file.

---

### MEDIUM — Password reset token stored in plaintext

**File:** `backend/app/models/user.py:48`

If the database is compromised, all pending password reset tokens are directly usable.

**Fix:** Store `hashlib.sha256(token.encode()).hexdigest()` in the DB; compare hashed value on reset.

---

### MEDIUM — Access token lifetime is 24 hours with no refresh mechanism

**File:** `backend/app/config.py:17`, `backend/app/services/auth.service.ts:14`

`ACCESS_TOKEN_EXPIRE_MINUTES=1440` is dangerously long. The `refreshToken` method in the frontend calls `/api/auth/refresh` which **does not exist** in the backend — it will 404. Token refresh is dead code.

**Fix:** Implement `POST /auth/refresh` with a separate short-lived access token (15–60 min) and long-lived refresh token (7 days).

---

### LOW — `GET /users/departments` requires no authentication

**File:** `backend/app/routers/users.py:36–39`

The department list endpoint has no `Depends(get_current_user)`. Any unauthenticated request can enumerate company department names.

---

## 4. Data Integrity & Data Leaks

| Issue | File | Detail |
|---|---|---|
| **Leave balance never decremented** | `leave.py` | Approval → no `used_days` update. Cancel → no `pending_days` decrement. Balance figures are always wrong. |
| **Payroll run is racy** | `payroll.py:132–138` | Two concurrent `POST /payroll/run` can both pass the existing check and create duplicate entries. Add `UNIQUE(employee_id, month, year)` constraint. |
| **Negative break time on midnight crossover** | `attendance.py:376–379` | If break starts at 23:58 and ends at 00:10, `combine(today, break_start)` > `combine(today, now)` → negative break minutes. |
| **Selfie stored in `notes` field** | `attendance.py:313` | Selfie URL stored in free-text `notes` field — a design hack with no dedicated column. Original `notes` value is silently overwritten. |
| **Predictable selfie filenames** | `attendance.py:283` | Filename = `{user_id}_{date.today()}{ext}`. UUID + date is deterministic for any known employee ID, making files guessable. |
| **PII in recent_activity** | `dashboard.py:156–166` | `avatar_url` included in activity feed response. If avatars are stored as filesystem paths, they leak internal path structure. |

---

## 5. Performance Bottlenecks

### N+1 Query Patterns

| Location | Pattern | Fix |
|---|---|---|
| `dashboard.py:169–186` | Sprint velocity: 1 DB query per sprint | Single `GROUP BY sprint_id` query |
| `dashboard.py:108–120` | Absent users: query IDs, then query names | `JOIN Attendance + User` in one query |
| `dashboard.py:122–141` | Pending approvals: 2 separate queries | `JOIN Leave + User` in one query |
| `dashboard.py:143–165` | Recent activity: 2 separate queries | `JOIN Attendance + User` in one query |

### Missing Database Indexes

| Column(s) | Reason |
|---|---|
| `attendance(date)` | Every check-in, cron job, and dashboard query filters by date |
| `attendance(employee_id, date)` | Composite index for check-in/check-out lookup |
| `leaves(status)` | Used in dashboard, approval queue queries |
| `payroll_entries(month, year)` | Used in every payroll list/summary query |
| `tasks(assignee_id, status)` | Used in employee dashboard and task listing |

### Blocking I/O in Async Handlers

**`payroll.py:449`** — `doc.build(elements)` is synchronous and CPU-bound. Blocks the entire event loop while rendering PDF.
```python
# Fix:
import asyncio
await asyncio.to_thread(doc.build, elements)
```

**`documents.py:71–73`** — Synchronous `open()` / `f.write()` inside an async route handler.
```python
# Fix: use aiofiles
import aiofiles
async with aiofiles.open(path, "wb") as f:
    await f.write(content)
```

### Connection Pool Wastage

**`absent_cron.py`, `carry_forward_cron.py`** — Both crons create a full new `create_async_engine` (and new connection pool) on every invocation. With two crons firing every minute, this is 2880+ engine create/dispose cycles per day, each one opening and closing DB connections.

**Fix:** Import and reuse the shared `engine` from `app.database` instead of creating a new one.

---

## 6. Code Quality Problems

| Problem | File | Detail |
|---|---|---|
| **Duplicate endpoint** | `payroll.py:227, 310` | `GET /payroll/{entry_id}` and `GET /payroll/payslips/{entry_id}` are identical handlers |
| **Manager sees all leaves, not team leaves** | `dashboard.py:212–214` | `pending_leaves` = ALL pending leaves company-wide, not this manager's direct reports |
| **Manager sees all overdue tasks** | `dashboard.py:221–224` | `overdue` = all overdue tasks system-wide, not manager's team |
| **`asyncio.create_task` for emails** | `auth.py:95`, `users.py:113` | Fire-and-forget tasks are silently dropped on server shutdown. Use FastAPI `BackgroundTasks`. |
| **`UserUpdate` doesn't block privileged field changes** | `users.py:145–146` | `setattr(user, field, value)` applies all non-None fields including `role` and `salary` with no role guard |
| **Dead code: `refreshToken` in frontend** | `auth.service.ts:14–15` | Calls `/api/auth/refresh` which doesn't exist in the backend. Will always 404. |
| **No password complexity validation** | `auth.py` | `change-password` has zero validation. `set-password` only checks length >= 8. No complexity rules. |
| **`_get_shift_cutoff` ignores company timezone** | `attendance.py:34–54` | Fetches `AttendanceConfig` and `CompanySettings` on every check-in request. Could be cached. |
| **Hardcoded `working_days = 26`** | `payroll.py:33` | Standard working days per month is hardcoded. Does not use company calendar, holidays, or actual working days. |

---

## 7. Production Risks

| Risk | Severity | Detail |
|---|---|---|
| **APScheduler multi-worker duplication** | Critical | With Gunicorn `-w N`, N workers each run all cron jobs. Absent cron will create N duplicate absent records per employee. |
| **No worker process isolation for scheduler** | Critical | APScheduler should run in only 1 worker (e.g., `if os.getenv('SERVER_WORKER_ID', '0') == '0'`) or in a dedicated process. |
| **Uploaded files not persisted across deploys** | High | `uploads/` is a local directory relative to the process working directory. On Docker/Kubernetes restarts, all uploaded documents and selfies are lost. Requires a volume mount or object storage (S3/GCS). |
| **No request body size limit** | High | FastAPI has no default body size limit. Large JSON payloads or file uploads can exhaust server memory. |
| **Health check doesn't verify DB** | Medium | `GET /api/health` returns `{"status": "ok"}` without pinging the database. Load balancers will route traffic to an instance with a broken DB connection. |
| **No structured logging / request IDs** | Medium | Errors are untracked across requests. No correlation IDs make production debugging very difficult. |
| **CORS allows HTTP origins** | Medium | Production should block `http://` origins and only allow `https://`. |
| **No pagination on org chart** | Low | `GET /users/org-chart` loads all active users into memory and returns the full set. Will degrade with 1000+ employees. |
| **PDF generation is unbounded** | Low | No timeout on `doc.build()`. A pathological payslip entry could hang a worker indefinitely. |
| **No graceful email drain on shutdown** | Low | `asyncio.create_task` welcome and reset emails are lost if the server shuts down before they complete. |

---

## 8. Feature Gaps

Based on the system's purpose and current implementation, the following high-impact gaps exist:

| Gap | Impact |
|---|---|
| **No refresh token endpoint** | Users must re-login every 24 hours, or the access token lifespan must stay dangerously long. The frontend already has `refreshToken` code — it just needs the backend endpoint. |
| **Leave balance not updated on approval** | The entire leave balance tracking feature is cosmetically correct but functionally broken. Every employee always shows their full allocated balance. |
| **Payroll doesn't deduct actual LOP** | Salary calculations are always full pay regardless of absences or unpaid leave. |
| **No audit trail for sensitive operations** | Role changes, salary edits, payroll runs, and document verifications have no audit log. |
| **No employee notification on payslip generation** | Employees are never notified when their payslip is ready. The `payslip_ready_email` preference column exists but is never triggered. |
| **`require_selfie` config is ignored** | The `AttendanceConfig.require_selfie` flag is checked nowhere. The regular `POST /check-in` accepts check-ins without a selfie even when selfie is required. |
| **No holiday awareness in leave calculation** | `total_days = (end_date - start_date).days + 1` doesn't subtract weekends or public holidays, causing over-counting. |
| **No password complexity enforcement** | Only minimum length (8 chars) on set-password. No uppercase, digit, or symbol requirements anywhere. |
| **No account lockout policy** | After unlimited failed login attempts, accounts remain active. |

---

## 9. Priority Fix List

### 🔴 Critical — Must Fix Before Production

| # | Issue | File |
|---|---|---|
| 1 | Move `/users/org-chart` before `/{user_id}` to unblock the feature | `routers/users.py` |
| 2 | Add role check + field whitelist to `PATCH /users/{user_id}` | `routers/users.py` |
| 3 | Set `DEBUG=False`, remove SQL echo in production | `.env` / `config.py` |
| 4 | Add startup validator to reject weak/default `SECRET_KEY` | `config.py` |
| 5 | Implement real `logout-all` with `revoked_all_before` timestamp | `routers/auth.py`, `models/user.py` |
| 6 | Run APScheduler in only 1 worker process | `main.py` |
| 7 | Update `LeaveBalance.used_days`/`pending_days` on leave approve/cancel | `routers/leave.py` |
| 8 | Serve `/uploads` through a protected endpoint, not public `StaticFiles` | `main.py` |
| 9 | Fix timezone in lateness detection (UTC vs local time) | `routers/attendance.py` |

### 🟡 Important Improvements

| # | Issue | File |
|---|---|---|
| 10 | Pass actual LOP days to `_calculate_entry` from leave records | `routers/payroll.py` |
| 11 | Remove `await session.commit()` from GET paths in `get_db` | `database.py` |
| 12 | Add `UNIQUE(employee_id, month, year)` to `PayrollEntry` | Migration |
| 13 | Replace per-sprint queries with single `GROUP BY` query | `routers/dashboard.py` |
| 14 | Fix `reset_password` timezone: `astimezone` not `replace` | `routers/auth.py` |
| 15 | Wrap `doc.build()` and file writes in `asyncio.to_thread` / `aiofiles` | `routers/payroll.py`, `routers/documents.py` |
| 16 | Add MIME type allowlist + 10 MB size limit on file uploads | `routers/documents.py`, `routers/attendance.py` |
| 17 | Fix `emp.department` → `emp.department.name` in payslip PDF | `routers/payroll.py` |
| 18 | Add `slowapi` rate limiting to login and forgot-password | `routers/auth.py` |
| 19 | Implement `POST /auth/refresh` with short-lived access + refresh token | `routers/auth.py` |
| 20 | Fix UUID vs string mismatch in dashboard `.in_()` queries | `routers/dashboard.py` |

### 🟢 Nice-to-Have

| # | Issue |
|---|---|
| 21 | Add missing DB indexes: `Attendance.date`, `Leave.status`, `PayrollEntry(month, year)` |
| 22 | Add DB connectivity ping to `GET /api/health` |
| 23 | Reuse shared `app.database.engine` in cron workers instead of creating new engines |
| 24 | Replace `asyncio.create_task` emails with FastAPI `BackgroundTasks` |
| 25 | Add holiday calendar awareness to leave day count calculation |
| 26 | Add password complexity validation (uppercase + digit + symbol) to `change-password` |
| 27 | Add account lockout after N failed login attempts |
| 28 | Move uploaded files to object storage (S3/GCS) instead of local disk |
| 29 | Add audit logging for sensitive operations (role changes, salary edits, payroll runs) |
| 30 | Paginate `GET /users/org-chart` for large organizations |

---

*Generated by automated production readiness audit on 2026-03-14.*
