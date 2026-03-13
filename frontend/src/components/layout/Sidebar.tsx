import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Clock, CalendarOff, FolderKanban,
  CheckSquare, Users, Wallet, BarChart2, Settings,
  ChevronLeft, ChevronRight, LogOut, Briefcase,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'
import { ROLES } from '@/constants/roles'
import Avatar from '@/components/common/Avatar'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles?: ROLES[]   // undefined = accessible by all
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',  path: ROUTES.DASHBOARD,  icon: <LayoutDashboard size={18} /> },
  { label: 'Attendance', path: ROUTES.ATTENDANCE,  icon: <Clock size={18} /> },
  { label: 'Leave',      path: ROUTES.LEAVE,       icon: <CalendarOff size={18} /> },
  { label: 'Projects',   path: ROUTES.PROJECTS,    icon: <FolderKanban size={18} /> },
  { label: 'Tasks',      path: ROUTES.TASKS,       icon: <CheckSquare size={18} /> },
  {
    label: 'Staff',
    path: ROUTES.STAFF,
    icon: <Users size={18} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.MANAGER],
  },
  {
    label: 'Payroll',
    path: ROUTES.PAYROLL,
    icon: <Wallet size={18} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR],
  },
  {
    label: 'Reports',
    path: ROUTES.REPORTS,
    icon: <BarChart2 size={18} />,
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.MANAGER],
  },
  { label: 'Settings', path: ROUTES.SETTINGS, icon: <Settings size={18} /> },
]

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false)
  const { user, hasRole, logout } = useAuth()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && hasRole(...item.roles)),
  )

  const handleLogout = () => {
    logout()
    navigate(ROUTES.LOGIN)
  }

  const fullName = user ? `${user.first_name} ${user.last_name}` : ''

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar text-sidebar-text transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Briefcase size={16} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-white font-semibold text-[15px] truncate">Workforce Pro</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-colors',
                isActive
                  ? 'bg-white/10 text-sidebar-active font-medium'
                  : 'text-sidebar-text hover:bg-white/5 hover:text-white',
              )
            }
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center h-10 border-t border-white/10 text-sidebar-text hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* User footer */}
      <div className="flex items-center gap-3 px-3 py-4 border-t border-white/10">
        {user && <Avatar name={fullName} src={user.avatar_url} size="sm" />}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{fullName}</p>
            <p className="text-sidebar-text text-xs truncate capitalize">{user?.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          className="text-sidebar-text hover:text-red-400 transition-colors flex-shrink-0"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
