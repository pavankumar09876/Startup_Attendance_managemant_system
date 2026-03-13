import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, ChevronDown, User, Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'
import Avatar from '@/components/common/Avatar'

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
  [ROUTES.PROFILE]:    'My Profile',
}

const Header = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Page title */}
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {user && <Avatar name={fullName} src={user.avatar_url} size="sm" />}
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{fullName}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {dropdownOpen && (
            <>
              {/* Close on outside click */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{fullName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate(ROUTES.PROFILE); setDropdownOpen(false) }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <User size={15} /> Profile
                </button>
                <button
                  onClick={() => { navigate(ROUTES.SETTINGS); setDropdownOpen(false) }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings size={15} /> Settings
                </button>
                <div className="border-t border-gray-100">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
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
