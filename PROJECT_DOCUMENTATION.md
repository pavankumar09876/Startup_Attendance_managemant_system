# Workforce Pro — Complete Project Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Roles & Permissions](#3-roles--permissions)
4. [Authentication & Security](#4-authentication--security)
5. [Modules & Features](#5-modules--features)
6. [API Endpoints](#6-api-endpoints)
7. [Database Models](#7-database-models)
8. [Frontend Pages & Components](#8-frontend-pages--components)
9. [Cron Jobs & Automation](#9-cron-jobs--automation)
10. [Configuration](#10-configuration)

---

## 1. System Overview

Workforce Pro is an enterprise-grade HR Management System covering the full employee lifecycle — from onboarding to payroll, attendance, leave, projects, and offboarding. It features role-based access control (5 roles), multi-level approvals, real-time notifications, and comprehensive reporting.

---

## 2. Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Framework | FastAPI (async) |
| Database | PostgreSQL + SQLAlchemy (async) |
| Migrations | Alembic (29 migrations) |
| Auth | JWT (access + refresh + MFA tokens) |
| MFA | TOTP (Google Authenticator compatible) |
| Rate Limiting | SlowAPI |
| Background Jobs | APScheduler (async) |
| Email | SMTP (aiosmtplib) |
| Real-time | WebSocket (notifications) |
| PDF | ReportLab (payslips) |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS (dark mode support) |
| State Management | Zustand (auth), TanStack React Query (server state) |
| Routing | React Router v6 |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Icons | Lucide React |
| Notifications | react-hot-toast |

---

## 3. Roles & Permissions

### 3.1 Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| **SUPER_ADMIN** | 1 | Full system access, all permissions |
| **ADMIN** | 2 | System administration, payroll finalization, settings |
| **HR** | 3 | Employee management, payroll processing, onboarding |
| **MANAGER** | 4 | Team management, project oversight, approvals |
| **EMPLOYEE** | 5 | Self-service access only |

### 3.2 Complete Permission Matrix

#### Staff & Employee Management

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| employee:view | All | All | All | Team | Self |
| employee:view_all | Y | Y | Y | - | - |
| employee:create | Y | Y | Y | - | - |
| employee:update | Y | Y | Y | - | - |
| employee:delete | Y | Y | - | - | - |
| employee:approve | Y | Y | Y | - | - |
| department:manage | Y | Y | Y | - | - |

#### Attendance

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| attendance:checkin | Y | Y | Y | Y | Y |
| attendance:view_own | Y | Y | Y | Y | Y |
| attendance:view_team | Y | Y | Y | Y | - |
| attendance:view_all | Y | Y | Y | - | - |
| attendance:create | Y | Y | Y | - | - |
| attendance:update | Y | Y | Y | - | - |
| attendance:export | Y | Y | Y | Y | - |
| attendance:approve_regularization | Y | Y | Y | Y | - |

#### Leave

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| leave:apply | Y | Y | Y | Y | Y |
| leave:view_own | Y | Y | Y | Y | Y |
| leave:view_team | Y | Y | Y | Y | - |
| leave:view_all | Y | Y | Y | - | - |
| leave:approve | Y | Y | Y | Y | - |
| leave:manage_holidays | Y | Y | Y | - | - |
| leave:manage_policies | Y | Y | Y | - | - |

#### Projects & Tasks

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| project:view | Y | Y | Y | Y | Y |
| project:create | Y | Y | - | Y | - |
| project:update | Y | Y | - | Y | - |
| project:delete | Y | Y | - | - | - |
| task:create | Y | Y | - | Y | Y |
| task:update | Y | Y | - | Y | Y (own) |
| task:delete | Y | Y | - | Y | - |

#### Payroll & Expenses

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| payroll:view_own | Y | Y | Y | Y | Y |
| payroll:view_all | Y | Y | Y | - | - |
| payroll:run | Y | - | Y | - | - |
| payroll:finalize | Y | Y | - | - | - |
| payroll:manage_balances | Y | Y | Y | - | - |
| expense:submit | Y | Y | Y | Y | Y |
| expense:view_own | Y | Y | Y | Y | Y |
| expense:view_all | Y | Y | Y | - | - |
| expense:approve | Y | Y | Y | Y | - |
| expense:manage_policies | Y | Y | - | - | - |

#### Reports

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| report:attendance | Y | Y | Y | - | - |
| report:payroll | Y | Y | - | - | - |
| report:project | Y | Y | - | - | - |
| report:team | Y | Y | Y | Y | - |
| report:financial | Y | Y | - | - | - |
| report:workforce | Y | Y | Y | - | - |

#### Settings

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| settings:company | Y | Y | - | - | - |
| settings:attendance | Y | Y | Y | - | - |
| settings:leave | Y | Y | Y | - | - |
| settings:notifications | Y | Y | Y | - | - |
| settings:roles | Y | Y | - | - | - |
| settings:shifts | Y | Y | Y | - | - |

#### Onboarding, Documents, Audit

| Permission | Super Admin | Admin | HR | Manager | Employee |
|-----------|:-----------:|:-----:|:--:|:-------:|:--------:|
| onboarding:view | Y | Y | Y | Y | - |
| onboarding:manage | Y | Y | Y | - | - |
| document:upload | Y | Y | Y | - | - |
| document:view | Y | Y | Y | - | - |
| audit:view | Y | Y | - | - | - |
| mfa:manage | Y | Y | Y | Y | Y |

---

## 4. Authentication & Security

### 4.1 Authentication Flow

```
Login (email + password)
  ├── MFA disabled → access_token + refresh_token
  └── MFA enabled  → mfa_token → /mfa/verify (TOTP code) → access_token + refresh_token
```

### 4.2 Token System

| Token | Lifetime | Purpose |
|-------|----------|---------|
| access_token | 24 hours | API requests (Bearer header) |
| refresh_token | 7 days | Exchange for new token pair |
| mfa_token | 5 minutes | Temporary token for MFA verification |

### 4.3 Security Features

| Feature | Description |
|---------|-------------|
| **Password Strength** | Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character |
| **Rate Limiting** | Login: 10/min, Forgot password: 5/min, Accept invite: 10/min |
| **Token Revocation** | Per-token (jti) + per-user (revoked_all_before timestamp) |
| **Session Management** | Max 5 concurrent sessions, oldest auto-deactivated |
| **IP Whitelist** | Admin IP whitelist enforced for payroll finalization |
| **Re-Authentication** | Required for sensitive changes (salary, role, termination) |
| **MFA** | TOTP-based (Google Authenticator), 10 backup codes |
| **Invite Tokens** | 72-hour expiry, one-time use, cleared after acceptance |
| **Audit Logging** | Immutable audit trail for all sensitive actions |

### 4.4 Data Scoping

| Role | Sees |
|------|------|
| Employee | Own records only |
| Manager | Own + direct reports (manager_id match) |
| HR / Admin / Super Admin | All records globally |

---

## 5. Modules & Features

### 5.1 Dashboard

**Admin Dashboard** (Super Admin, Admin, HR):
- Stat cards: Total Employees, Present Today, Pending Leaves, Open Projects
- Attendance trend (30-day line chart: present vs absent vs late)
- Department headcount (bar chart)
- Leave distribution (pie chart by type)
- Absent today list with last-seen time
- Pending approvals queue (leave, expense)
- Recent activity feed
- Sprint velocity chart (committed vs completed story points)

**Manager Dashboard**:
- Stat cards: My Projects, Tasks Due Today, Team Members, Budget Used %
- Project progress chart
- Task status breakdown (pie chart)
- At-risk tasks list
- Budget utilization warnings

**Employee Dashboard**:
- Stat cards: Attendance %, Leave Balance, Open Tasks, Hours This Week
- Live check-in/check-out with duration timer
- Location selector (Office / Remote / WFH)
- Break start/end buttons
- My tasks list with status
- My leaves with approval status
- Next holiday & deadline display

### 5.2 Attendance

**Employee Features:**
- Real-time clock in/out with location selection
- Break tracking (start/end with duration)
- Geofence-based check-in (optional, configurable radius)
- Calendar month view with color-coded status dots
- Attendance heatmap visualization
- Regularization request for past dates
- Monthly/yearly statistics

**Manager/HR Features:**
- Team attendance table with filters (date range, employee, status)
- Override attendance records (manually adjust times)
- Regularization approval workflow
- CSV export
- Summary stats (present, absent, late, half-day, on-leave, WFH)

**Configurable Rules:**
- Grace period (minutes)
- Half-day threshold (hours)
- Overtime calculation threshold
- Auto-mark absent after configurable time
- Late penalty (fixed amount or percentage)
- Absent penalty (days deducted)
- Max late days before deduction kicks in

### 5.3 Leave Management

**Leave Types:** Annual, Sick, Casual, Maternity, Paternity, Unpaid, Comp-Off

**Employee Features:**
- View leave balances by type
- Apply for leave (date range, type, reason, half-day option)
- Cancel pending leaves
- Leave history with status tracking

**Manager/HR Features:**
- Multi-level approval (Level 1: Manager, Level 2: HR/Admin)
- Bulk approve/reject
- Leave reports by type and employee

**Policy Configuration:**
- Days per year per type
- Carry forward (enabled/disabled, max days)
- Sandwich rule (weekends between leave days counted)
- Half-day leave option
- Negative balance (borrow future leave)
- Leave encashment
- Accrual type: yearly, monthly, quarterly
- Probation period before eligibility

### 5.4 Projects

**Project Management:**
- Create projects with name, client, description, priority, dates, budget
- Project statuses: Planning, Active, In Progress, On Hold, Completed, Cancelled
- Priority levels: Low, Medium, High, Critical
- Budget tracking (total vs spent)
- Progress percentage
- Team member management with project roles (Owner, Manager, Contributor, Viewer)

**Sprint Management (Agile):**
- Create sprints with name, goal, start/end dates, capacity (story points)
- Sprint statuses: Planned, Active, Completed
- Start/complete sprint workflow
- Burndown chart data
- Sprint velocity tracking

**Task Management:**
- Task fields: title, description, status, priority, assignee, due date, estimated hours, story points
- Issue types: Task, Bug, Story, Epic
- Task statuses: Todo, In Progress, In Review, Done, Blocked
- Subtask support (parent-child hierarchy)
- Task dependencies (blocking relationships)
- Task comments with user attribution
- Time logging per task
- Activity log (immutable history of all changes)
- Saved filter views (presets)
- Labels (JSON array)
- Recurring tasks (daily, weekly, biweekly, monthly)

**Views:**
- Kanban board (drag-and-drop columns)
- List view (filterable, sortable table)
- Grid view (project cards)

### 5.5 Staff Management

**Employee CRUD:**
- Create employee with: personal info, employment details, salary, role, department
- Auto-generate employee ID
- Welcome email with temporary password
- Bulk import via CSV upload
- Edit employee details (re-auth required for sensitive fields)
- Suspend/reactivate employee
- Terminate employee with reason

**Employee Detail Views:**
- Profile tab (personal + employment info)
- Attendance tab (monthly calendar + summary)
- Projects tab (assigned projects with roles)
- Leave tab (balances + history)
- Payroll tab (payslips + salary components)
- Documents tab (uploads + verification status)

**Department Management:**
- Create/edit/delete departments
- Department types: IT, Non-IT, Other
- Department head assignment
- Employee count per department

**Org Chart:**
- Hierarchical visualization of reporting structure
- Manager-to-employee relationships

**Maker-Checker Pattern:**
- Employee creation requests (maker step)
- Approval/rejection by authorized approver (checker step)
- Cannot approve own request

### 5.6 Payroll & Finance

**Payroll Processing:**
- Run payroll for month/year (HR)
- Finalize payroll (Admin, IP-whitelist enforced)
- Mark as paid (individual or bulk)
- Payroll statuses: Pending → Processed → Finalized → Paid

**Salary Components:**
- Basic salary, HRA, Travel allowance, Other allowances
- Overtime pay, Bonus
- PF deduction (12% employee + 12% employer)
- TDS, ESI (employee + employer)
- Professional tax
- Loss-of-pay deduction
- Gross salary → Total deductions → Net salary

**Payslip:**
- PDF generation with all components
- Employee self-service download
- Revision history (immutable snapshots)

**Expense Management:**
- Submit expense: title, category, amount, date, receipt, merchant, payment method
- Categories: Travel, Meals, Equipment, Software, Mileage, Other
- Payment methods: Cash, Company Card, Personal Card, UPI, Bank Transfer
- Multi-stage approval (Manager → Finance → CFO)
- Auto-approve below threshold
- Receipt upload
- Mileage calculation (configurable rate per km)
- Currency support with exchange rates
- Expense policies (max amount, receipt required, auto-approve threshold)
- Billable/non-billable flag

**Leave Balance Management:**
- Allocate annual leave balances
- Carry-forward calculation
- Monthly/quarterly accrual

### 5.7 Enterprise Onboarding

**Employee Lifecycle:**
```
OFFER_SENT → OFFER_ACCEPTED → PRE_ONBOARDING → JOINED → ACTIVE
                                                       → TRAINING → ACTIVE
                                                       → BENCH → ACTIVE
Legacy: INVITED → ACTIVE
Any status → SUSPENDED → ACTIVE
Any status → TERMINATED
```

**Status Transitions:**
- Enforced transition rules (only valid next statuses allowed)
- Activation gates before ACTIVE:
  - BGV cleared (if configured as required)
  - Required documents submitted
  - Required checklist items completed
- Full transition history with timestamps and notes
- Visual employee timeline

**Background Verification (BGV):**
- Initiate BGV with vendor name and verification items
- Item types: Employment History, Education, Criminal Record, Address, Identity
- Per-item status tracking: Pending → In Progress → Verified / Failed / N/A
- Auto-calculate overall BGV status from item statuses
- Configurable: BGV required before ACTIVE (company setting)

**Onboarding Checklists:**
- Template system: create reusable checklist templates
- Template targeting: by role and/or department
- Items with: title, description, category (HR/IT/Employee/Finance/General), assignee role, required flag
- Assign template to employee (creates instance)
- Per-employee progress tracking (total, completed, required)
- Self-service: employees can complete their own items
- Category-based organization

**Multi-Step Approval Chains:**
- Configurable approval chain per employee creation request
- Multiple approval levels (e.g., Level 1: Manager, Level 2: HR, Level 3: Admin)
- Role-based + person-based approver matching
- Admin/Super Admin bypass
- Visual approval chain with step status
- Auto-create employee on final approval

**Document Requirements:**
- Define required documents by type (PAN Card, Aadhaar, Bank Proof, etc.)
- Target by role and/or department
- Mandatory vs optional
- Expiry tracking
- Track submission status per employee

**Invite-Based Onboarding:**
- Generate secure invite token (72-hour expiry)
- Send invite email with branded template
- Public accept-invite page with password creation
- Password strength validation
- Auto-transition status on acceptance
- One-time use (token cleared after acceptance)

**Joining Instructions:**
- Template system for joining instruction emails
- Target by role and/or department
- HTML body with rich formatting
- Joining details: first-day schedule, reporting location, reporting time
- Manager notification tracking
- Joining kit sent tracking

**Dashboard:**
- Pipeline stage counts (bar chart)
- Total onboarding count
- BGV status distribution (pie chart)
- Average checklist progress
- Pending approvals count

**Pipeline View:**
- Employee cards with status badges
- Filter by status
- Search by name/email
- Quick actions: Transition, Send Invite, View Checklist, View Timeline
- Status transition modal with target selection and notes

**Cron Automation:**
- Expire invite tokens past deadline
- Stale onboarding reminders (configurable days threshold)
- Notify HR/Admin users about stuck employees

### 5.8 Reports & Analytics

| Report | Available To | Data |
|--------|-------------|------|
| Attendance | Admin, HR | Daily trends, per-employee stats, status breakdown |
| Leave | Admin, HR | Usage by type, approval rates, balance analysis |
| Payroll | Admin | Summary by department, cost breakdown, salary distribution |
| Team | Admin, HR, Manager | Headcount, turnover, utilization |
| Projects | Admin | Status, budget, progress, task completion rates |
| Financial | Admin | Cost trends, salary distribution, department costs |
| Workforce | Admin, HR | Age demographics, tenure, diversity |

### 5.9 Settings

| Section | Available To | Features |
|---------|-------------|----------|
| My Profile | All | Edit name, phone, bio, avatar, change password |
| Company | Admin | Name, logo, industry, size, address, timezone, working days, work hours, IP whitelist, BGV requirement, stale onboarding days |
| Attendance Rules | Admin, HR | Grace period, half-day threshold, overtime, geofence, WFH, selfie, auto-absent, reminders, penalty config |
| Shifts | Admin, HR | Create/edit/delete shifts (name, start/end time, grace, night shift) |
| Leave Policies | Admin, HR | Leave types CRUD, carry-forward, sandwich rule, encashment, accrual |
| Roles & Permissions | Super Admin, Admin | Module-level permission grid (view/create/edit/delete/approve) per role |
| Notifications | All | Per-event email + in-app toggles |

### 5.10 Notifications

**Delivery Channels:**
- In-app (real-time via WebSocket)
- Email (SMTP)

**Notification Types:**
| Type | Trigger | Priority |
|------|---------|----------|
| Leave Requested | New leave request | High |
| Leave Approved/Rejected | Leave decision | Normal |
| Task Assigned | Task assigned to user | Normal |
| Payslip Ready | Payslip processed | Normal |
| Expense Submitted | New expense claim | Normal |
| Expense Reviewed | Expense decision | Normal |
| Attendance Regularized | Regularization approved | Normal |
| Project Deadline | Approaching deadline | Normal |
| Check-in Reminder | Configurable time | Normal |
| Check-out Reminder | Configurable time | Normal |
| Stale Onboarding | Employee stuck > N days | High |
| General | System notifications | Normal |

**Features:**
- Unread count badge
- Category-based filtering
- Priority levels (low, normal, high, urgent)
- Mark as read/actioned
- Action buttons (approve/reject directly from notification)
- Auto-expiry
- Notification preferences per user

### 5.11 Documents

**Document Types:** Offer Letter, ID Proof, Certificate, NDA, PAN Card, Aadhaar, Bank Proof, Education, Experience, Address Proof, Photo, Other

**Features:**
- Upload documents with type classification
- Verification workflow (HR/Admin marks as verified)
- Expiry date tracking
- Link to onboarding document requirements
- Required vs optional documents per role/department

### 5.12 MFA (Multi-Factor Authentication)

- TOTP-based (Google Authenticator, Authy, etc.)
- Setup: Generate secret → QR code → Verify code → Enable
- Login flow: Password → MFA token → TOTP code → Full access
- 10 backup codes (one-time use, burned after use)
- Disable: Requires password + current TOTP code

### 5.13 Audit Logging

- Immutable audit trail for all sensitive actions
- Fields: actor, action, entity type/ID, description, metadata (JSON), IP address
- Filterable by entity type, entity ID, actor
- Admin-only access

### 5.14 Global Search

- Ctrl+K / Cmd+K command palette
- Searches across: Employees, Projects, Tasks
- Returns top 5 results per category
- Direct navigation links

---

## 6. API Endpoints

### 6.1 Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/login` | Login (email + password). Rate: 10/min | - |
| GET | `/me` | Get current user profile | Required |
| GET | `/sessions` | List active sessions | Required |
| DELETE | `/sessions/{id}` | Revoke session | Required |
| POST | `/change-password` | Change password (requires current) | Required |
| POST | `/set-password` | Set password (first login) | Required |
| POST | `/forgot-password` | Request reset email. Rate: 5/min | - |
| POST | `/reset-password` | Reset with token | - |
| POST | `/logout` | Revoke current token | Required |
| POST | `/logout-all` | Revoke all sessions | Required |
| POST | `/refresh` | Refresh token pair | Bearer |
| POST | `/accept-invite` | Accept invite + set password. Rate: 10/min | - |

### 6.2 Users (`/api/users`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/departments` | List departments | - |
| POST | `/departments` | Create department | department:manage |
| PATCH | `/departments/{id}` | Update department | department:manage |
| DELETE | `/departments/{id}` | Delete department | department:manage |
| GET | `/generate-id` | Auto-generate employee ID | - |
| GET | `/` | List users (filtered, paginated) | employee:view |
| POST | `/` | Create employee | employee:create |
| GET | `/{id}` | Get user detail | - |
| PATCH | `/{id}` | Update user (re-auth for sensitive) | - |
| DELETE | `/{id}` | Terminate employee (re-auth) | employee:delete |
| POST | `/{id}/suspend` | Suspend employee | employee:update |
| POST | `/{id}/reactivate` | Reactivate employee | employee:update |
| GET | `/org-chart` | Get org chart data | - |
| POST | `/requests` | Submit pending request (maker) | employee:create |
| GET | `/requests` | List pending requests | employee:create |
| POST | `/requests/{id}/approve` | Approve request (checker) | employee:approve |
| POST | `/requests/{id}/reject` | Reject request | employee:approve |

### 6.3 Attendance (`/api/attendance`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/` | List attendance records | attendance:view_own |
| POST | `/check-in` | Clock in | attendance:checkin |
| POST | `/check-out` | Clock out | attendance:checkin |
| POST | `/break/start` | Start break | attendance:checkin |
| POST | `/break/end` | End break | attendance:checkin |
| POST | `/check-in/geo` | Geofence check-in | attendance:checkin |
| POST | `/` | Manual attendance create | attendance:create |
| PATCH | `/{id}` | Update attendance record | attendance:update |
| GET | `/summary/{employee_id}` | Monthly summary | attendance:view_own |
| POST | `/approve-regularization/{id}` | Approve regularization | attendance:approve_regularization |
| GET | `/team` | Team attendance | attendance:view_team |
| POST | `/export` | Export CSV | attendance:export |

### 6.4 Leave (`/api/leaves`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/my` | My leave history | - |
| GET | `/` | List leaves (scoped) | leave:view_own/team/all |
| GET | `/balances` | My leave balances | - |
| GET | `/holidays` | Holiday list | - |
| POST | `/` | Apply for leave | leave:apply |
| GET | `/{id}` | Leave details | - |
| PATCH | `/{id}` | Update leave | - |
| DELETE | `/{id}` | Cancel leave | - |
| POST | `/{id}/approve` | Approve leave | leave:approve |
| POST | `/{id}/reject` | Reject leave | leave:approve |
| POST | `/bulk-approve` | Bulk approve | leave:approve |
| POST | `/encash` | Encash leave balance | - |

### 6.5 Projects (`/api/projects`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/` | List projects | - |
| POST | `/` | Create project | project:create |
| GET | `/{id}` | Project details | - |
| PATCH | `/{id}` | Update project | project:update |
| DELETE | `/{id}` | Delete project | project:delete |
| POST | `/{id}/members` | Add member | project:update |
| PATCH | `/{id}/members/{uid}` | Update member role | project:update |
| DELETE | `/{id}/members/{uid}` | Remove member | project:update |
| GET | `/{id}/tasks` | List project tasks | - |
| POST | `/{id}/tasks` | Create task | task:create |
| GET | `/{id}/tasks/{tid}` | Task details | - |
| PATCH | `/{id}/tasks/{tid}` | Update task | task:update |
| DELETE | `/{id}/tasks/{tid}` | Delete task | task:delete |

### 6.6 Sprints (`/api/sprints`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/{pid}/sprints` | List project sprints | - |
| POST | `/{pid}/sprints` | Create sprint | project:update |
| PATCH | `/{pid}/sprints/{sid}` | Update sprint | project:update |
| DELETE | `/{pid}/sprints/{sid}` | Delete sprint | project:delete |
| POST | `/{pid}/sprints/{sid}/start` | Start sprint | project:update |
| POST | `/{pid}/sprints/{sid}/complete` | Complete sprint | project:update |
| GET | `/{pid}/sprints/{sid}/burndown` | Burndown data | - |

### 6.7 Global Tasks (`/api/tasks`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/` | All tasks (scoped) | - |
| GET | `/my-tasks` | My assigned tasks | - |
| GET | `/{id}` | Task details | - |
| PATCH | `/{id}` | Update task | task:update |
| DELETE | `/{id}` | Delete task | task:delete |
| POST | `/{id}/comments` | Add comment | - |
| GET | `/{id}/comments` | Get comments | - |
| POST | `/{id}/dependencies` | Add dependency | - |
| GET | `/{id}/dependencies` | Get dependencies | - |
| POST | `/{id}/time-logs` | Log time | - |
| GET | `/saved-views` | Get saved filter views | - |
| POST | `/saved-views` | Create saved view | - |

### 6.8 Payroll (`/api/payroll`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/summary` | Payroll summary | payroll:view_all |
| GET | `/` | List payroll entries | payroll:view_all |
| POST | `/run` | Run payroll for month | payroll:run |
| POST | `/finalize` | Finalize payroll (IP whitelist) | payroll:finalize |
| POST | `/{id}/mark-paid` | Mark entry as paid | payroll:finalize |
| POST | `/mark-all-paid` | Bulk mark as paid | payroll:finalize |
| GET | `/{id}` | Entry details | payroll:view_all |
| GET | `/{id}/payslip` | Generate payslip PDF | payroll:view_all |
| POST | `/allocate-balances` | Allocate leave balances | payroll:manage_balances |
| GET | `/revisions/{id}` | Payroll revision history | payroll:view_all |

### 6.9 Expenses (`/api/expenses`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/` | List expenses (scoped) | expense:view_own/all |
| POST | `/` | Submit expense | expense:submit |
| GET | `/{id}` | Expense details | - |
| PATCH | `/{id}` | Update expense | - |
| DELETE | `/{id}` | Cancel expense | - |
| POST | `/{id}/approve` | Approve expense | expense:approve |
| POST | `/{id}/reject` | Reject expense | expense:approve |
| POST | `/policies` | Create policy | expense:manage_policies |
| GET | `/policies` | List policies | - |
| PATCH | `/policies/{id}` | Update policy | expense:manage_policies |

### 6.10 Onboarding (`/api/onboarding`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/employees/{id}/transition` | Transition status | onboarding:manage |
| GET | `/employees/{id}/transitions` | Transition history | onboarding:view |
| POST | `/employees/{id}/bgv` | Initiate BGV | onboarding:manage |
| GET | `/employees/{id}/bgv` | Get BGV status | onboarding:view |
| PATCH | `/bgv-items/{id}` | Update BGV item | onboarding:manage |
| GET | `/checklist-templates` | List templates | onboarding:manage |
| POST | `/checklist-templates` | Create template | onboarding:manage |
| POST | `/employees/{id}/checklist` | Assign checklist | onboarding:manage |
| GET | `/employees/{id}/checklist` | Get employee checklist | onboarding:view |
| PATCH | `/checklist-items/{id}` | Toggle checklist item | Self-service + manage |
| POST | `/employees/{id}/invite` | Send invite email | onboarding:manage |
| POST | `/requests` | Create approval request | employee:create |
| GET | `/requests` | List requests | employee:create |
| GET | `/requests/{id}` | Request detail | employee:create |
| POST | `/requests/{id}/approve` | Approve step | employee:approve |
| POST | `/requests/{id}/reject` | Reject step | employee:approve |
| GET | `/document-requirements` | List doc requirements | onboarding:manage |
| POST | `/document-requirements` | Create doc requirement | onboarding:manage |
| DELETE | `/document-requirements/{id}` | Delete requirement | onboarding:manage |
| GET | `/employees/{id}/required-documents` | Employee doc status | onboarding:view |
| GET | `/joining-templates` | List joining templates | onboarding:manage |
| POST | `/joining-templates` | Create joining template | onboarding:manage |
| POST | `/employees/{id}/send-joining-instructions` | Send joining email | onboarding:manage |
| GET | `/employees/{id}/joining-details` | Get joining details | onboarding:view |
| POST | `/employees/{id}/joining-details` | Set joining details | onboarding:manage |
| GET | `/dashboard` | Onboarding dashboard | onboarding:view |
| GET | `/pipeline` | Pipeline employees | onboarding:view |

### 6.11 Documents (`/api/documents`)

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/` | List documents | document:view |
| POST | `/` | Upload document | document:upload |
| PATCH | `/{id}` | Update document | document:upload |
| DELETE | `/{id}` | Delete document | document:upload |
| POST | `/{id}/verify` | Verify document | document:upload |

### 6.12 MFA (`/api/mfa`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/setup` | Generate TOTP secret + QR | Required |
| POST | `/verify-setup` | Verify code to enable MFA | Required |
| POST | `/disable` | Disable MFA (password + TOTP) | Required |
| POST | `/verify` | Verify TOTP during login | mfa_token |
| POST | `/backup-verify` | Use backup code | mfa_token |

### 6.13 Other Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| GET | `/api/dashboard/admin` | Admin dashboard data | - |
| GET | `/api/dashboard/manager` | Manager dashboard data | - |
| GET | `/api/dashboard/employee` | Employee dashboard data | - |
| GET | `/api/reports/attendance` | Attendance report | report:attendance |
| GET | `/api/reports/leave` | Leave report | report:attendance |
| GET | `/api/reports/payroll` | Payroll report | report:payroll |
| GET | `/api/reports/team` | Team report | report:team |
| GET | `/api/reports/projects` | Projects report | report:project |
| GET | `/api/reports/financial` | Financial report | report:financial |
| GET | `/api/reports/workforce` | Workforce report | report:workforce |
| GET | `/api/notifications` | List notifications | - |
| PATCH | `/api/notifications/{id}` | Mark as read | - |
| DELETE | `/api/notifications/{id}` | Delete notification | - |
| GET | `/api/notifications/summary` | Unread count by category | - |
| GET | `/api/audit` | Audit logs | audit:view |
| GET | `/api/search` | Global search (employees, projects, tasks) | - |
| GET | `/api/health` | Health check (DB + Redis + uptime) | - |
| GET | `/api/files/{path}` | Serve uploaded files | Required |

---

## 7. Database Models

### 7.1 Core Models

**users** — Employee records with full profile, salary, auth, onboarding fields
**departments** — Organization departments with type and head
**pending_employee_requests** — Maker-checker employee creation workflow

### 7.2 Attendance & Leave

**attendance** — Daily check-in/out records with breaks, status, hours
**leaves** — Leave requests with type, dates, approval status
**leave_approvals** — Multi-level leave approval chain
**leave_balances** — Per-employee per-year leave balance tracking

### 7.3 Projects & Tasks

**projects** — Project with client, budget, status, priority, manager
**project_members** — Many-to-many user-project with project role
**tasks** — Tasks with status, priority, assignee, sprint, story points, parent/epic
**task_comments** — User comments on tasks
**task_activities** — Immutable change log for tasks
**task_dependencies** — Blocking relationships between tasks
**recurring_tasks** — Auto-created task templates
**time_logs** — Hours logged per task per user
**saved_task_views** — Saved filter presets
**sprints** — Agile sprints with capacity and status

### 7.4 Payroll & Finance

**payroll_entries** — Monthly salary calculation with all components
**payslip_versions** — Immutable revision snapshots
**expenses** — Expense claims with category, receipt, approval
**expense_approvals** — Multi-stage expense approval
**expense_policies** — Rules for expense categories

### 7.5 Onboarding

**background_verifications** — BGV tracking per employee
**bgv_items** — Individual verification items
**onboarding_checklist_templates** — Reusable checklist templates
**checklist_template_items** — Items within templates
**employee_checklist_items** — Per-employee checklist instances
**employee_approval_steps** — Multi-step approval chain steps
**document_requirements** — Required documents configuration
**onboarding_status_transitions** — Immutable status change audit
**joining_instructions** — Email templates for joining info
**employee_joining_details** — Per-employee joining logistics

### 7.6 System

**company_settings** — Singleton company configuration
**attendance_config** — Singleton attendance rules
**leave_policies** — Leave type configurations
**holidays** — Company/public holidays
**role_permissions** — Module-level UI permission toggles
**permissions** — Granular permission codes
**default_role_permissions** — Role-to-permission seed mapping
**custom_roles** — User-defined roles with permission arrays
**notification_preferences** — Per-user notification toggles
**notifications** — In-app notification records
**audit_logs** — Immutable action audit trail
**user_sessions** — Active session tracking
**revoked_tokens** — Revoked JWT tokens
**shifts** — Work shift definitions
**documents** — Employee document uploads

---

## 8. Frontend Pages & Components

### 8.1 Routes

| Route | Page | Access |
|-------|------|--------|
| `/login` | Login | Public |
| `/forgot-password` | Forgot Password | Public |
| `/reset-password` | Reset Password | Public |
| `/auth/set-password` | Set First Password | Authenticated |
| `/auth/accept-invite` | Accept Invite | Public |
| `/dashboard` | Dashboard | All roles |
| `/attendance` | Attendance | All roles |
| `/leave` | Leave Management | All roles |
| `/projects` | Projects | All roles |
| `/projects/:id` | Project Detail | All roles |
| `/tasks` | Tasks | All roles |
| `/staff` | Staff Management | Admin, HR, Manager |
| `/staff/:id` | Employee Detail | Admin, HR, Manager |
| `/onboarding` | Onboarding | Admin, HR |
| `/payroll` | Payroll | Admin, HR |
| `/reports` | Reports | Admin, HR, Manager |
| `/settings` | Settings | All roles |

### 8.2 Shared Components

| Component | Description |
|-----------|-------------|
| Avatar | User avatar with initials fallback |
| Badge | Color-coded status/label badge |
| Button | Primary/Secondary/Danger/Ghost with loading state |
| Modal | Dialog with backdrop blur, title, size variants |
| DatePicker | Calendar date selector |
| Pagination | Page navigation |
| Spinner | Loading indicator |
| EmptyState | Empty state with icon, title, description, action |
| NotificationBell | Notification dropdown with unread count |
| ProtectedRoute | Auth + role-based route guard |
| CommandPalette | Ctrl+K search and navigation |
| ErrorBoundary | Error fallback UI |

### 8.3 Layout

| Component | Description |
|-----------|-------------|
| AppLayout | Main wrapper with sidebar + header + content outlet |
| Sidebar | Collapsible navigation with role-based menu items |
| Header | Top bar with page title, search, dark mode, notifications, user menu |

---

## 9. Cron Jobs & Automation

| Job | Schedule | Description |
|-----|----------|-------------|
| **Reminders** | Every minute | Check-in/check-out reminders based on configured times |
| **Auto Absent** | Every minute | Mark employees absent after configured time |
| **Carry Forward** | Jan 1, 00:05 | Carry forward leave balances for new year |
| **Escalation** | Daily 9:00 | Escalate unactioned items |
| **Daily Digest** | Daily 8:00 | Send daily summary email |
| **Onboarding** | Daily 9:30 | Expire invite tokens + stale onboarding reminders |

---

## 10. Configuration

### 10.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | Required |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| SECRET_KEY | JWT signing key (32+ chars) | Required |
| ALLOWED_ORIGINS | CORS origins (comma-separated) | http://localhost:3000 |
| SMTP_HOST | Email server host | - |
| SMTP_PORT | Email server port | 587 |
| SMTP_USER | Email username | - |
| SMTP_PASS | Email password | - |
| EMAIL_FROM | Sender email address | - |
| SCHEDULER_WORKER | Enable cron jobs (true/false) | false |
| VITE_API_URL | Frontend API base URL | http://localhost:8000 |

### 10.2 Alembic Migrations

29 sequential migrations (`0001` through `0029`) covering:
- Core tables (users, departments, attendance, leave)
- Projects, tasks, sprints
- Payroll, expenses, leave balances
- Notifications, audit logs, sessions
- Settings, shifts, documents
- MFA, permissions, custom roles
- Enterprise onboarding (BGV, checklists, approvals, transitions)
- Onboarding settings (BGV required, stale days)

---

*Generated for Workforce Pro v1.0.0*
