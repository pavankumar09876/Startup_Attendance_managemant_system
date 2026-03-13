import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'

import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import AttendancePage from '@/pages/attendance/AttendancePage'
import LeavePage from '@/pages/leave/LeavePage'
import ProjectsPage from '@/pages/projects/ProjectsPage'
import TasksPage from '@/pages/tasks/TasksPage'
import StaffPage from '@/pages/staff/StaffPage'
import PayrollPage from '@/pages/payroll/PayrollPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import SettingsPage from '@/pages/settings/SettingsPage'

// Protect routes — redirect to /login if not authenticated
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to={ROUTES.LOGIN} replace />
}

const App = () => (
  <Routes>
    {/* Public */}
    <Route path={ROUTES.LOGIN} element={<LoginPage />} />

    {/* Protected — wrapped in AppLayout (sidebar + header) */}
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
      <Route path={ROUTES.PROJECTS}   element={<ProjectsPage />} />
      <Route path={ROUTES.TASKS}      element={<TasksPage />} />
      <Route path={ROUTES.STAFF}      element={<StaffPage />} />
      <Route path={ROUTES.PAYROLL}    element={<PayrollPage />} />
      <Route path={ROUTES.REPORTS}    element={<ReportsPage />} />
      <Route path={ROUTES.SETTINGS}   element={<SettingsPage />} />
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
  </Routes>
)

export default App
