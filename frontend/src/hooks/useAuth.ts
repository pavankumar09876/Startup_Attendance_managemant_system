import { useAuthStore } from '@/store/authStore'
import { ROLES } from '@/constants/roles'

export const useAuth = () => {
  const { user, token, setAuth, setUser, logout } = useAuthStore()

  const isAuthenticated = !!token && !!user

  const hasRole = (...roles: ROLES[]) =>
    !!user && roles.includes(user.role as ROLES)

  const isAdmin = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN)
  const isHR = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR)
  const isManager = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER)

  return { user, token, isAuthenticated, hasRole, isAdmin, isHR, isManager, setAuth, setUser, logout }
}
