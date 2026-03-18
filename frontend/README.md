# Workforce Pro — Frontend

React SPA built with TypeScript, Tailwind CSS, and Vite.

## Tech Stack

- **Framework:** React 18.3 with TypeScript 5.5
- **Build:** Vite 5.4
- **Styling:** Tailwind CSS 3.4 (dark mode support)
- **State:** Zustand 5.0 (persisted auth store)
- **Data Fetching:** TanStack Query 5.59
- **Forms:** React Hook Form 7.53 + Zod validation
- **Routing:** React Router v6
- **HTTP:** Axios 1.7 (auto token refresh)
- **Charts:** Recharts 2.13
- **Icons:** Lucide React
- **Drag & Drop:** dnd-kit (Kanban board)
- **Notifications:** react-hot-toast
- **PDF Export:** jsPDF + html2canvas
- **Testing:** Vitest + Testing Library + Playwright (E2E)

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit VITE_API_URL if backend is not at localhost:8000

# Start dev server
npm run dev
```

App runs at http://localhost:3000. API requests proxy to the backend at http://localhost:8000.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 3000) |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run e2e` | Run Playwright end-to-end tests |

## Project Structure

```
src/
├── App.tsx                    # Root component with routing
├── main.tsx                   # Entry point
├── index.css                  # Tailwind directives & global styles
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # Shell with sidebar + header
│   │   ├── Header.tsx         # Top bar (role-based nav, notifications)
│   │   └── Sidebar.tsx        # Side navigation
│   │
│   ├── common/                # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Pagination.tsx
│   │   ├── DatePicker.tsx
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   ├── Skeleton.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── NotificationBell.tsx
│   │   └── ProtectedRoute.tsx # Auth guard with role check
│   │
│   ├── CommandPalette.tsx     # Ctrl+K global search
│   ├── EmptyState.tsx
│   └── KeyboardShortcuts.tsx
│
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   └── SetPasswordPage.tsx       # Forced first-login password change
│   │
│   ├── dashboard/
│   │   ├── DashboardPage.tsx          # Routes to role-specific dashboard
│   │   └── components/
│   │       ├── AdminDashboard.tsx     # Stats: employees, attendance, leave
│   │       ├── ManagerDashboard.tsx   # Direct reports overview
│   │       ├── EmployeeDashboard.tsx  # Personal stats & tasks
│   │       ├── StatCard.tsx
│   │       └── DashboardSkeleton.tsx
│   │
│   ├── attendance/
│   │   ├── AttendancePage.tsx         # Tab container
│   │   ├── MyAttendance.tsx           # Personal clock in/out & history
│   │   ├── TeamAttendance.tsx         # Team view with filters
│   │   ├── AttendanceHeatmap.tsx      # Calendar heatmap visualization
│   │   └── RegularizationForm.tsx     # Request attendance correction
│   │
│   ├── leave/
│   │   ├── LeavePage.tsx              # Tab container
│   │   ├── MyLeaves.tsx               # Personal leave history & balances
│   │   ├── LeaveApprovals.tsx         # Approve/reject pending requests
│   │   ├── HolidayCalendar.tsx        # Company holidays
│   │   └── ApplyLeaveModal.tsx        # Leave application form
│   │
│   ├── projects/
│   │   ├── ProjectsPage.tsx           # Project list with filters
│   │   ├── ProjectDetailPage.tsx      # Single project view
│   │   ├── CreateProjectModal.tsx     # Multi-step project creation
│   │   ├── SprintBoard.tsx            # Kanban view of sprint tasks
│   │   ├── SprintSection.tsx          # Sprint management
│   │   ├── BacklogSection.tsx         # Backlog task list
│   │   ├── BurndownChart.tsx          # Sprint progress chart
│   │   ├── CreateSprintModal.tsx
│   │   └── CompleteSprintModal.tsx
│   │
│   ├── tasks/
│   │   ├── TasksPage.tsx              # All tasks (admin view)
│   │   ├── MyTasksPage.tsx            # Personal tasks
│   │   ├── KanbanBoard.tsx            # Drag & drop board
│   │   ├── KanbanColumn.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskDetailModal.tsx
│   │   └── CreateTaskModal.tsx
│   │
│   ├── staff/
│   │   ├── StaffPage.tsx              # Employee list with search
│   │   ├── EmployeeDetailPage.tsx     # Full employee profile
│   │   ├── AddEmployeeModal.tsx       # Multi-step employee creation
│   │   ├── EditEmployeeModal.tsx
│   │   ├── BulkImportModal.tsx        # CSV bulk import
│   │   ├── DepartmentsPage.tsx        # Department management
│   │   ├── OrgChart.tsx               # Organization hierarchy
│   │   └── EmployeeDocuments.tsx      # Document management
│   │
│   ├── payroll/
│   │   ├── PayrollPage.tsx            # Payroll management
│   │   ├── MyPayslipsPage.tsx         # Personal payslips
│   │   ├── ExpensesPage.tsx           # Expense claims
│   │   ├── PayslipDetailModal.tsx     # Payslip breakdown
│   │   ├── RunPayrollModal.tsx        # Monthly payroll processing
│   │   └── SubmitExpenseModal.tsx
│   │
│   ├── reports/
│   │   ├── ReportsPage.tsx            # Report hub
│   │   ├── AttendanceReport.tsx
│   │   ├── PayrollReport.tsx
│   │   ├── ProjectReport.tsx
│   │   ├── TeamReport.tsx
│   │   ├── ReportScheduler.tsx        # Schedule recurring reports
│   │   └── AnalyticsDashboard.tsx     # Charts & KPIs
│   │
│   └── settings/
│       ├── SettingsPage.tsx           # Settings hub
│       ├── MyProfileSettings.tsx      # Personal profile edit
│       ├── CompanySettings.tsx        # Company info (admin only)
│       ├── AttendanceSettings.tsx     # Work hours, grace period
│       ├── LeaveSettings.tsx          # Leave types & policies
│       ├── NotificationSettings.tsx   # Email & in-app preferences
│       ├── RolesPermissions.tsx       # Role management
│       └── ShiftManagement.tsx        # Shift schedules
│
├── services/                  # API client layer
│   ├── api.ts                 # Axios instance (interceptors, token refresh)
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── staff.service.ts
│   ├── attendance.service.ts
│   ├── leave.service.ts
│   ├── project.service.ts
│   ├── task.service.ts
│   ├── sprint.service.ts
│   ├── payroll.service.ts
│   ├── dashboard.service.ts
│   ├── reports.service.ts
│   ├── settings.service.ts
│   └── shift.service.ts
│
├── hooks/                     # Custom React hooks
│   ├── useAuth.ts             # Auth state & actions
│   ├── useDarkMode.ts         # Theme toggle
│   ├── useDebounce.ts         # Input debouncing
│   ├── useKeyboardShortcut.ts # Hotkey registration
│   ├── usePagination.ts       # Pagination state
│   └── useWebSocket.ts        # Real-time updates
│
├── store/
│   └── authStore.ts           # Zustand store (persisted to localStorage)
│
├── types/                     # TypeScript interfaces
│   ├── user.types.ts
│   ├── attendance.types.ts
│   ├── leave.types.ts
│   ├── project.types.ts
│   └── payroll.types.ts
│
├── utils/
│   ├── cn.ts                  # Tailwind class merge utility
│   ├── formatDate.ts
│   ├── formatCurrency.ts
│   └── exportPdf.ts           # HTML-to-PDF export
│
└── constants/
    ├── roles.ts
    ├── routes.ts
    └── status.ts
```

## Key Patterns

### Authentication
- JWT tokens stored in Zustand (persisted to `localStorage`)
- Axios interceptor auto-attaches `Authorization: Bearer` header
- 401 responses trigger silent token refresh; queued requests retry automatically
- `ProtectedRoute` component guards routes by role

### API Layer
- Each service file wraps Axios calls for one domain (attendance, leave, etc.)
- 422 errors from Pydantic are normalized to readable strings in the response interceptor
- All queries use TanStack Query for caching, background refetching, and loading states

### Forms
- React Hook Form + Zod for type-safe validation
- Multi-step forms use `trigger(fields)` for per-step validation
- Empty strings converted to `null` via Pydantic validators on the backend

### Dark Mode
- Tailwind `dark:` classes throughout
- `useDarkMode` hook toggles `dark` class on `<html>`
- Persisted to `localStorage`

### Keyboard Shortcuts
- `Ctrl+K` — Command palette (global search)
- Other shortcuts registered via `useKeyboardShortcut` hook

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket URL |

## Building for Production

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server (nginx, Caddy, etc.). Configure the server to redirect all routes to `index.html` for client-side routing.

Example nginx config:
```nginx
server {
    listen 80;
    root /var/www/workforce-pro/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000;
    }
}
```
