import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { authService } from '@/services/auth.service'

// Role → default landing page after login
const ROLE_REDIRECT: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: ROUTES.DASHBOARD,
  [ROLES.ADMIN]:       ROUTES.DASHBOARD,
  [ROLES.HR]:          ROUTES.DASHBOARD,
  [ROLES.MANAGER]:     ROUTES.PROJECTS,
  [ROLES.EMPLOYEE]:    ROUTES.ATTENDANCE,
}

export const useAuth = () => {
  const { user, token, setAuth, setUser, logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()

  const isAuthenticated = !!token && !!user

  const hasRole = (...roles: ROLES[]): boolean =>
    !!user && roles.includes(user.role as ROLES)

  const isAdmin   = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN)
  const isHR      = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR)
  const isManager = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER)

  /** Call after a successful login mutation to persist and redirect. */
  const login = (userData: typeof user, accessToken: string) => {
    if (!userData) return
    setAuth(userData, accessToken)
    // Force password change before anything else
    if (userData.must_change_password) {
      navigate(ROUTES.SET_PASSWORD, { replace: true })
      return
    }
    const redirect = ROLE_REDIRECT[userData.role] ?? ROUTES.DASHBOARD
    navigate(redirect, { replace: true })
  }

  /** Re-fetch the current user from the API and update the store. */
  const refreshUser = async () => {
    const latest = await authService.getMe()
    setUser(latest)
  }

  /** Clear everything and go to /login. */
  const logout = () => {
    storeLogout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  return {
    user,
    token,
    isAuthenticated,
    hasRole,
    isAdmin,
    isHR,
    isManager,
    login,
    logout,
    refreshUser,
    setAuth,
    setUser,
  }
}
