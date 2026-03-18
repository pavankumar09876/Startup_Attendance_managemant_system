import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Clock, CalendarOff, CheckSquare, Timer,
  LogIn, LogOut, Calendar, AlertCircle,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

import type { EmployeeStats } from '@/services/dashboard.service'
import { attendanceService } from '@/services/attendance.service'
import { formatDate, formatTime } from '@/utils/formatDate'
import { LEAVE_STATUS_COLORS, TASK_PRIORITY_COLORS } from '@/constants/status'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'
import Button from '@/components/common/Button'
import StatCard from './StatCard'

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-4">
    <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h3>
    {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
  </div>
)

const TASK_STATUS_COLORS: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-yellow-100 text-yellow-700',
  done:        'bg-green-100 text-green-700',
}

interface Props { data: EmployeeStats }

const EmployeeDashboard = ({ data }: Props) => {
  const queryClient = useQueryClient()
  const [localStatus, setLocalStatus] = useState(data.check_in_status)

  const { mutate: checkIn, isPending: checkingIn } = useMutation({
    mutationFn: attendanceService.checkIn,
    onSuccess: (rec) => {
      setLocalStatus({ checked_in: true, check_in_time: rec.check_in ?? undefined, duration_minutes: 0 })
      toast.success('Checked in successfully!')
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'employee'] })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Check-in failed'),
  })

  const { mutate: checkOut, isPending: checkingOut } = useMutation({
    mutationFn: attendanceService.checkOut,
    onSuccess: () => {
      toast.success('Checked out. Have a great day!')
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'employee'] })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Check-out failed'),
  })

  const durationStr = localStatus.duration_minutes !== undefined
    ? `${Math.floor(localStatus.duration_minutes / 60)}h ${localStatus.duration_minutes % 60}m`
    : null

  return (
    <div className="space-y-6">
      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Attendance This Month"
          value={`${data.attendance_pct.toFixed(1)}%`}
          subtext="Days present"
          icon={<Clock size={18} />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          trend={data.attendance_pct >= 80 ? 2 : -3}
          trendLabel="vs last month"
        />
        <StatCard
          label="Leave Balance"
          value={data.leave_balance}
          subtext="Days remaining"
          icon={<CalendarOff size={18} />}
          iconBg="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          label="Open Tasks"
          value={data.open_tasks}
          subtext="Assigned to me"
          icon={<CheckSquare size={18} />}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          trend={data.open_tasks > 5 ? 10 : 0}
          trendLabel="vs last week"
        />
        <StatCard
          label="Hours This Week"
          value={`${data.hours_this_week.toFixed(1)}h`}
          subtext="Total logged"
          icon={<Timer size={18} />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
      </div>

      {/* ── Leave Balance Chart ─────────────────────────────────── */}
      {data.leave_consumption && data.leave_consumption.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="Leave Balance" subtitle="Used vs available days by type" />
          <ResponsiveContainer width="100%" height={Math.max(160, data.leave_consumption.length * 50)}>
            <BarChart layout="vertical" data={data.leave_consumption} margin={{ top: 4, right: 30, bottom: 0, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={56} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="used"  fill="#DC2626" radius={[0,4,4,0]} name="Used" />
              <Bar dataKey="total" fill="#BFDBFE" radius={[0,4,4,0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Today's status card + panels ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Check-in card */}
        <div className={`card p-6 flex flex-col items-center justify-center text-center gap-4
          ${!localStatus.checked_in ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20' : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'}`}
        >
          {!localStatus.checked_in ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <LogIn size={28} className="text-green-600" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">Good to go?</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">You haven't checked in yet today.</p>
              </div>
              <Button
                variant="primary"
                loading={checkingIn}
                onClick={() => checkIn()}
                className="w-full bg-green-600 hover:bg-green-700 py-3 text-base"
              >
                <LogIn size={16} /> Check In Now
              </Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <LogOut size={28} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">You're checked in</p>
                {localStatus.check_in_time && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Since{' '}
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {formatTime(new Date(`2000-01-01T${localStatus.check_in_time}`))}
                    </span>
                  </p>
                )}
                {durationStr && (
                  <p className="text-sm text-blue-600 font-semibold mt-1">{durationStr} elapsed</p>
                )}
              </div>
              <Button
                variant="secondary"
                loading={checkingOut}
                onClick={() => checkOut()}
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 py-3"
              >
                <LogOut size={16} /> Check Out
              </Button>
            </>
          )}
        </div>

        {/* My tasks */}
        <div className="card p-5">
          <SectionTitle title="My Tasks Today" subtitle="Assigned to you" />
          {data.my_tasks.length === 0 ? (
            <EmptyState title="No tasks" description="You have no tasks assigned." />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.my_tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-start gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{task.project}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      label={task.status}
                      className={TASK_STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-600'}
                    />
                    <Badge
                      label={task.priority}
                      className={TASK_PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'}
                    />
                  </div>
                </div>
              ))}
              {data.my_tasks.length > 5 && (
                <p className="text-xs text-blue-600 pt-3 text-center">
                  +{data.my_tasks.length - 5} more tasks
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right column: leaves + upcoming */}
        <div className="flex flex-col gap-4">
          {/* My leaves */}
          <div className="card p-5 flex-1">
            <SectionTitle title="My Leave Requests" subtitle="Recent 3" />
            {data.my_leaves.length === 0 ? (
              <EmptyState title="No requests" description="You have no recent leave requests." />
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.my_leaves.map((leave) => (
                  <div key={leave.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 capitalize">
                        {leave.leave_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(leave.start_date, 'MMM d')} – {formatDate(leave.end_date, 'MMM d')}
                      </p>
                    </div>
                    <Badge
                      label={leave.status}
                      className={LEAVE_STATUS_COLORS[leave.status] ?? 'bg-gray-100 text-gray-600'}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="card p-5">
            <SectionTitle title="Upcoming" />
            <div className="space-y-3">
              {data.next_holiday && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar size={14} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Next Holiday</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{data.next_holiday.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(data.next_holiday.date)}</p>
                  </div>
                </div>
              )}
              {data.next_deadline && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={14} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Next Deadline</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate max-w-[160px]">
                      {data.next_deadline.title}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {data.next_deadline.project} · {formatDate(data.next_deadline.due_date)}
                    </p>
                  </div>
                </div>
              )}
              {!data.next_holiday && !data.next_deadline && (
                <p className="text-sm text-gray-400 dark:text-gray-500">Nothing upcoming.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeDashboard
