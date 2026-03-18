import { useState } from 'react'
import {
  User, Building2, Clock, CalendarDays, ShieldCheck, Bell, Layers,
} from 'lucide-react'

import { useAuth }              from '@/hooks/useAuth'
import { ROLES }                from '@/constants/roles'
import { cn }                   from '@/utils/cn'
import MyProfileSettings        from './MyProfileSettings'
import CompanySettings          from './CompanySettings'
import AttendanceSettings       from './AttendanceSettings'
import LeaveSettings            from './LeaveSettings'
import RolesPermissions         from './RolesPermissions'
import NotificationSettings     from './NotificationSettings'
import ShiftManagement          from './ShiftManagement'

type SettingsSection =
  | 'profile'
  | 'company'
  | 'attendance'
  | 'shifts'
  | 'leave'
  | 'roles'
  | 'notifications'

interface NavItem {
  id: SettingsSection
  label: string
  icon: React.ReactNode
  description: string
  adminOnly?: boolean
  superAdminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'profile',
    label: 'My Profile',
    icon: <User size={16} />,
    description: 'Personal info, avatar, password',
  },
  {
    id: 'company',
    label: 'Company',
    icon: <Building2 size={16} />,
    description: 'Name, logo, timezone, schedule',
    adminOnly: true,
  },
  {
    id: 'attendance',
    label: 'Attendance Rules',
    icon: <Clock size={16} />,
    description: 'Grace period, WFH, geo-fence',
    adminOnly: true,
  },
  {
    id: 'shifts',
    label: 'Shifts',
    icon: <Layers size={16} />,
    description: 'Define work shifts for employees',
    adminOnly: true,
  },
  {
    id: 'leave',
    label: 'Leave Policies',
    icon: <CalendarDays size={16} />,
    description: 'Leave types, carry forward',
    adminOnly: true,
  },
  {
    id: 'roles',
    label: 'Roles & Permissions',
    icon: <ShieldCheck size={16} />,
    description: 'Module-level access control',
    superAdminOnly: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell size={16} />,
    description: 'Email and in-app preferences',
  },
]

const SECTION_TITLES: Record<SettingsSection, string> = {
  profile:       'My Profile',
  company:       'Company Settings',
  attendance:    'Attendance Rules',
  shifts:        'Shift Management',
  leave:         'Leave Policies',
  roles:         'Roles & Permissions',
  notifications: 'Notifications',
}

const SECTION_DESCRIPTIONS: Record<SettingsSection, string> = {
  profile:       'Manage your personal information and account security.',
  company:       'Configure your organisation details, branding, and work schedule.',
  attendance:    'Define rules that govern how attendance is tracked for all employees.',
  shifts:        'Create and manage work shifts. Assign shifts to employees from their profile.',
  leave:         'Set up leave types, entitlements, and carry-forward policies.',
  roles:         'Control what each role can view or modify across every module.',
  notifications: 'Choose which events trigger email or in-app notifications.',
}

const SettingsPage = () => {
  const { isAdmin, hasRole } = useAuth()
  const canAdmin      = isAdmin || hasRole(ROLES.HR)
  const isSuperAdmin  = hasRole(ROLES.SUPER_ADMIN)

  const [section, setSection] = useState<SettingsSection>('profile')

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin
    if (item.adminOnly)      return canAdmin
    return true
  })

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* ── Settings nav sidebar ───────────────────────────────── */}
      <aside className="w-56 shrink-0">
        <div className="card p-2 sticky top-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">
            Settings
          </p>
          <nav className="space-y-0.5">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                  section === item.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white',
                )}
              >
                <span className={cn(
                  section === item.id ? 'text-white' : 'text-gray-400 dark:text-gray-500',
                )}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Content panel ─────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {/* Section header */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{SECTION_TITLES[section]}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{SECTION_DESCRIPTIONS[section]}</p>
        </div>

        {/* Section content */}
        <div>
          {section === 'profile'       && <MyProfileSettings />}
          {section === 'company'       && canAdmin      && <CompanySettings />}
          {section === 'attendance'    && canAdmin      && <AttendanceSettings />}
          {section === 'shifts'        && canAdmin      && <ShiftManagement />}
          {section === 'leave'         && canAdmin      && <LeaveSettings />}
          {section === 'roles'         && isSuperAdmin  && <RolesPermissions />}
          {section === 'notifications' && <NotificationSettings />}
        </div>
      </main>
    </div>
  )
}

export default SettingsPage
