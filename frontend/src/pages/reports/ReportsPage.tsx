import { useState } from 'react'
import { BarChart2, Calendar, Users, DollarSign, Clock, TrendingUp } from 'lucide-react'

import AttendanceReport from './AttendanceReport'
import ProjectReport    from './ProjectReport'
import TeamReport       from './TeamReport'
import PayrollReport    from './PayrollReport'
import ReportScheduler  from './ReportScheduler'
import AnalyticsDashboard from './AnalyticsDashboard'
import { useAuth }      from '@/hooks/useAuth'
import { ROLES }        from '@/constants/roles'
import { cn }           from '@/utils/cn'

type ReportTab = 'analytics' | 'attendance' | 'projects' | 'team' | 'payroll' | 'scheduled'

const TABS: { id: ReportTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: 'analytics',  label: 'Analytics',    icon: <TrendingUp size={15} />, adminOnly: true },
  { id: 'attendance', label: 'Attendance',   icon: <Calendar  size={15} /> },
  { id: 'projects',   label: 'Projects',     icon: <BarChart2 size={15} /> },
  { id: 'team',       label: 'Team',         icon: <Users     size={15} /> },
  { id: 'payroll',    label: 'Payroll',      icon: <DollarSign size={15} />, adminOnly: true },
  { id: 'scheduled',  label: 'Scheduled',    icon: <Clock      size={15} />, adminOnly: true },
]

const ReportsPage = () => {
  const { isAdmin, hasRole } = useAuth()
  const canViewPayroll = isAdmin || hasRole(ROLES.HR)
  const [tab, setTab] = useState<ReportTab>(canViewPayroll ? 'analytics' : 'attendance')

  const visibleTabs = TABS.filter((t) => !t.adminOnly || canViewPayroll)

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Data-driven insights across attendance, projects, team performance, and payroll.
          </p>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Report content ──────────────────────────────────────── */}
      {tab === 'analytics'  && canViewPayroll && <AnalyticsDashboard />}
      {tab === 'attendance' && <AttendanceReport />}
      {tab === 'projects'   && <ProjectReport />}
      {tab === 'team'       && <TeamReport />}
      {tab === 'payroll'    && canViewPayroll && <PayrollReport />}
      {tab === 'scheduled'  && canViewPayroll && <ReportScheduler />}
    </div>
  )
}

export default ReportsPage
