import { Navigate, useLocation } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import { ROLES } from '@/constants/roles'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ROLES[]
}

const Forbidden = () => (
  <div className="min-h-screen flex items-center justify-center bg-page">
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <ShieldOff size={28} className="text-red-500" />
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Access Denied</h1>
      <p className="text-gray-500 text-sm mb-6">
        You don't have permission to view this page.
      </p>
      <a
        href={ROUTES.DASHBOARD}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Dashboard
      </a>
    </div>
  </div>
)

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { token, user } = useAuthStore()
  const location = useLocation()

  // Not authenticated → redirect to login, preserve intended path
  if (!token || !user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  }

  // Authenticated but role not allowed → 403
  if (allowedRoles && !allowedRoles.includes(user.role as ROLES)) {
    return <Forbidden />
  }

  return <>{children}</>
}

export default ProtectedRoute
