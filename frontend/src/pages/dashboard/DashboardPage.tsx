import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/constants/roles'
import {
  dashboardService,
  type AdminStats,
  type ManagerStats,
  type EmployeeStats,
} from '@/services/dashboard.service'

import AdminDashboard    from './components/AdminDashboard'
import ManagerDashboard  from './components/ManagerDashboard'
import EmployeeDashboard from './components/EmployeeDashboard'
import {
  AdminDashboardSkeleton,
  ManagerDashboardSkeleton,
  EmployeeDashboardSkeleton,
} from './components/DashboardSkeleton'

// ── Greeting ──────────────────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Error card ────────────────────────────────────────────────────────────────
const DashboardError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
      <span className="text-red-500 text-2xl font-bold">!</span>
    </div>
    <p className="text-gray-700 dark:text-gray-200 font-medium mb-1">Failed to load dashboard</p>
    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Something went wrong while fetching your data.</p>
    <button onClick={onRetry} className="text-sm text-blue-600 hover:underline">
      Try again
    </button>
  </div>
)

// ── Role-specific data hooks ──────────────────────────────────────────────────
const AdminView = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: dashboardService.getAdminStats,
    staleTime: 1000 * 60 * 3,
  })
  if (isLoading) return <AdminDashboardSkeleton />
  if (isError || !data) return <DashboardError onRetry={refetch} />
  return <AdminDashboard data={data as AdminStats} />
}

const ManagerView = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'manager'],
    queryFn: dashboardService.getManagerStats,
    staleTime: 1000 * 60 * 3,
  })
  if (isLoading) return <ManagerDashboardSkeleton />
  if (isError || !data) return <DashboardError onRetry={refetch} />
  return <ManagerDashboard data={data as ManagerStats} />
}

const EmployeeView = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: dashboardService.getEmployeeStats,
    staleTime: 1000 * 60 * 1,   // check-in status needs frequent refresh
  })
  if (isLoading) return <EmployeeDashboardSkeleton />
  if (isError || !data) return <DashboardError onRetry={refetch} />
  return <EmployeeDashboard data={data as EmployeeStats} />
}

// ── Page ──────────────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { user } = useAuth()

  const firstName = user?.first_name ?? 'there'
  const today     = format(new Date(), 'EEEE, MMMM d, yyyy')

  const renderDashboard = () => {
    switch (user?.role) {
      case ROLES.SUPER_ADMIN:
      case ROLES.ADMIN:
      case ROLES.HR:
        return <AdminView />
      case ROLES.MANAGER:
        return <ManagerView />
      case ROLES.EMPLOYEE:
      default:
        return <EmployeeView />
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {getGreeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{today}</p>
      </div>

      {/* Role-based dashboard */}
      {renderDashboard()}
    </div>
  )
}

export default DashboardPage
