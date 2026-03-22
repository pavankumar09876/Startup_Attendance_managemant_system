import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown, User, Settings, LogOut, Moon, Sun, Search, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDarkMode } from '@/hooks/useDarkMode'
import { ROUTES } from '@/constants/routes'
import Avatar from '@/components/common/Avatar'
import NotificationBell from '@/components/common/NotificationBell'

// Map route path → page title
const PAGE_TITLES: Record<string, string> = {
  [ROUTES.DASHBOARD]:  'Dashboard',
  [ROUTES.ATTENDANCE]: 'Attendance',
  [ROUTES.LEAVE]:      'Leave Management',
  [ROUTES.PROJECTS]:   'Projects',
  [ROUTES.TASKS]:      'Tasks',
  [ROUTES.STAFF]:      'Staff',
  [ROUTES.PAYROLL]:    'Payroll',
  [ROUTES.REPORTS]:    'Reports',
  [ROUTES.SETTINGS]:   'Settings',
  [ROUTES.ONBOARDING]: 'Onboarding',
  [ROUTES.PROFILE]:    'My Profile',
}

const Header = ({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { isDark, toggle: toggleDark } = useDarkMode()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const title = PAGE_TITLES[pathname] ?? 'Workforce Pro'
  const fullName = user ? `${user.first_name} ${user.last_name}` : ''

  const handleLogout = () => {
    logout()
    navigate(ROUTES.LOGIN)
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu size={18} />
          </button>
        )}
        {/* Page title */}
        <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Ctrl+K hint */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs transition-colors"
        >
          <Search size={12} />
          <span>Search</span>
          <kbd className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1 rounded font-mono">⌘K</kbd>
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notification bell */}
        <NotificationBell />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {user && <Avatar name={fullName} src={user.avatar_url} size="sm" />}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:block">{fullName}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate(ROUTES.PROFILE); setDropdownOpen(false) }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <User size={15} /> Profile
                </button>
                <button
                  onClick={() => { navigate(ROUTES.SETTINGS); setDropdownOpen(false) }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Settings size={15} /> Settings
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
