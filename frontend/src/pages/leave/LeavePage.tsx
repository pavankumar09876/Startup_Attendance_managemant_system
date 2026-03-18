import { useState } from 'react'
import { CalendarDays, CheckCircle2, CalendarRange } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/constants/roles'

import MyLeaves       from './MyLeaves'
import LeaveApprovals from './LeaveApprovals'
import HolidayCalendar from './HolidayCalendar'

type Tab = 'my' | 'approvals' | 'holidays'

const LeavePage = () => {
  const { hasRole } = useAuth()
  const canApprove  = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.MANAGER)
  // Super Admin & Admin don't take leaves — they only manage/approve
  const isAdminRole = hasRole(ROLES.SUPER_ADMIN, ROLES.ADMIN)

  // Admin roles go straight to approvals; employees see their own leaves
  const [activeTab, setActiveTab] = useState<Tab>(canApprove ? 'approvals' : 'my')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    // Hide "My Leaves" for super_admin / admin — they don't take leave
    ...(!isAdminRole
      ? [{ id: 'my' as Tab, label: 'My Leaves', icon: <CalendarDays size={15} /> }]
      : []),
    ...(canApprove
      ? [{ id: 'approvals' as Tab, label: 'Approvals', icon: <CheckCircle2 size={15} /> }]
      : []),
    { id: 'holidays', label: 'Holiday Calendar', icon: <CalendarRange size={15} /> },
  ]

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'my'        && !isAdminRole && <MyLeaves />}
      {activeTab === 'approvals' && <LeaveApprovals />}
      {activeTab === 'holidays'  && <HolidayCalendar />}
    </div>
  )
}

export default LeavePage
