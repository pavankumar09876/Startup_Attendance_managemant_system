import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { ROLES } from '@/constants/roles'

import ProtectedRoute from '@/components/common/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import CommandPalette from '@/components/CommandPalette'
import KeyboardShortcuts from '@/components/KeyboardShortcuts'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import SetPasswordPage from '@/pages/auth/SetPasswordPage'

// App pages
import DashboardPage  from '@/pages/dashboard/DashboardPage'
import AttendancePage from '@/pages/attendance/AttendancePage'
import LeavePage      from '@/pages/leave/LeavePage'
import ProjectsPage      from '@/pages/projects/ProjectsPage'
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage'
import TasksPage      from '@/pages/tasks/TasksPage'
import StaffPage            from '@/pages/staff/StaffPage'
import EmployeeDetailPage   from '@/pages/staff/EmployeeDetailPage'
import PayrollPage    from '@/pages/payroll/PayrollPage'
import ReportsPage    from '@/pages/reports/ReportsPage'
import SettingsPage   from '@/pages/settings/SettingsPage'

const App = () => (
  <>
  <CommandPalette />
  <KeyboardShortcuts />
  <Routes>
    {/* ── Public routes ─────────────────────────────────────── */}
    <Route path={ROUTES.LOGIN}           element={<LoginPage />} />
    <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
    <Route path={ROUTES.RESET_PASSWORD}  element={<ResetPasswordPage />} />
    <Route
      path={ROUTES.SET_PASSWORD}
      element={
        <ProtectedRoute>
          <SetPasswordPage />
        </ProtectedRoute>
      }
    />

    {/* ── Protected routes (all roles) ──────────────────────── */}
    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path={ROUTES.DASHBOARD}  element={<DashboardPage />} />
      <Route path={ROUTES.ATTENDANCE} element={<AttendancePage />} />
      <Route path={ROUTES.LEAVE}      element={<LeavePage />} />
      <Route path={ROUTES.PROJECTS}        element={<ProjectsPage />} />
      <Route path={ROUTES.PROJECT_DETAIL} element={<ProjectDetailPage />} />
      <Route path={ROUTES.TASKS}      element={<TasksPage />} />
      <Route path={ROUTES.SETTINGS}   element={<SettingsPage />} />

      {/* ── Role-restricted routes ───────────────────────────── */}
      <Route
        path={ROUTES.STAFF}
        element={
          <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.MANAGER]}>
            <StaffPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.STAFF_DETAIL}
        element={
          <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.MANAGER]}>
            <EmployeeDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.PAYROLL}
        element={
          <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR]}>
            <PayrollPage />
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.REPORTS}
        element={
          <ProtectedRoute
            allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.MANAGER]}
          >
            <ReportsPage />
          </ProtectedRoute>
        }
      />
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
  </Routes>
  </>
)

export default App
