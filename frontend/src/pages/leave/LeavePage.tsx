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

  const [activeTab, setActiveTab] = useState<Tab>('my')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'my',       label: 'My Leaves',       icon: <CalendarDays size={15} /> },
    ...(canApprove
      ? [{ id: 'approvals' as Tab, label: 'Approvals', icon: <CheckCircle2 size={15} /> }]
      : []),
    { id: 'holidays', label: 'Holiday Calendar', icon: <CalendarRange size={15} /> },
  ]

  return (
    <div>
      {/* Tab switcher */}
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

      {/* Content */}
      {activeTab === 'my'        && <MyLeaves />}
      {activeTab === 'approvals' && <LeaveApprovals />}
      {activeTab === 'holidays'  && <HolidayCalendar />}
    </div>
  )
}

export default LeavePage
