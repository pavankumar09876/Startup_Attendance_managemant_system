import { useState } from 'react'
import { Clock, Users } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/constants/roles'
import MyAttendance   from './MyAttendance'
import TeamAttendance from './TeamAttendance'

type Tab = 'my' | 'team'

const AttendancePage = () => {
  const { user, hasRole } = useAuth()
  const canViewTeam = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.MANAGER)

  // Default to 'team' for admins/managers, 'my' for employees
  const [activeTab, setActiveTab] = useState<Tab>(canViewTeam ? 'team' : 'my')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'my',   label: 'My Attendance', icon: <Clock size={15} /> },
    ...(canViewTeam
      ? [{ id: 'team' as Tab, label: 'Team Attendance', icon: <Users size={15} /> }]
      : []),
  ]

  return (
    <div>
      {/* Tab switcher */}
      {tabs.length > 1 && (
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeTab === 'my'   && <MyAttendance />}
      {activeTab === 'team' && <TeamAttendance />}
    </div>
  )
}

export default AttendancePage
