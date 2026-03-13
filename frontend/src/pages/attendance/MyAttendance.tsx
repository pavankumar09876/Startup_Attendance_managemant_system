import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isToday, isFuture, parseISO,
} from 'date-fns'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, MapPin, Clock,
  LogIn, LogOut, Plus, Calendar,
} from 'lucide-react'

import { attendanceService } from '@/services/attendance.service'
import { useAuth } from '@/hooks/useAuth'
import type { Attendance, TodayStatus, Regularization } from '@/types/attendance.types'
import { formatDate } from '@/utils/formatDate'
import { ATTENDANCE_STATUS_COLORS } from '@/constants/status'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import RegularizationForm from './RegularizationForm'

// ── Dot colors by status ──────────────────────────────────────────────────────
const DOT_COLORS: Record<string, string> = {
  present:  'bg-green-500',
  late:     'bg-amber-400',
  absent:   'bg-red-400',
  wfh:      'bg-blue-400',
  on_leave: 'bg-purple-400',
  half_day: 'bg-orange-400',
  holiday:  'bg-gray-300',
  weekend:  'bg-gray-200',
}

const LEGEND = [
  { label: 'Present',  color: 'bg-green-500' },
  { label: 'Late',     color: 'bg-amber-400' },
  { label: 'Absent',   color: 'bg-red-400' },
  { label: 'WFH',      color: 'bg-blue-400' },
  { label: 'Leave',    color: 'bg-purple-400' },
  { label: 'Weekend',  color: 'bg-gray-200' },
]

// ── Live clock ────────────────────────────────────────────────────────────────
const useLiveClock = () => {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ── Duration HH:MM:SS from check-in time string ───────────────────────────────
const useLiveDuration = (checkInTime?: string) => {
  const [duration, setDuration] = useState('')
  useEffect(() => {
    if (!checkInTime) { setDuration(''); return }
    const tick = () => {
      const [h, m, s] = checkInTime.split(':').map(Number)
      const start = new Date()
      start.setHours(h, m, s, 0)
      const diffSec = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000))
      const hh = String(Math.floor(diffSec / 3600)).padStart(2, '0')
      const mm = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0')
      const ss = String(diffSec % 60).padStart(2, '0')
      setDuration(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [checkInTime])
  return duration
}

// ── Today card ────────────────────────────────────────────────────────────────
const TodayCard = ({ status, onStatusChange }: {
  status: TodayStatus
  onStatusChange: () => void
}) => {
  const now      = useLiveClock()
  const duration = useLiveDuration(status.checked_in ? status.check_in_time : undefined)
  const [location, setLocation] = useState<'office' | 'remote'>('office')
  const queryClient = useQueryClient()

  const { mutate: clockIn, isPending: clockingIn } = useMutation({
    mutationFn: () => attendanceService.clockIn(location),
    onSuccess: () => {
      toast.success('Clocked in successfully!')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] })
      onStatusChange()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Clock-in failed'),
  })

  const { mutate: clockOut, isPending: clockingOut } = useMutation({
    mutationFn: attendanceService.clockOut,
    onSuccess: () => {
      toast.success('Clocked out. Have a great day!')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] })
      onStatusChange()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Clock-out failed'),
  })

  return (
    <div className="card p-8 flex flex-col items-center text-center">
      {/* Live time */}
      <p className="text-5xl font-bold text-gray-900 tabular-nums tracking-tight mb-1">
        {format(now, 'HH:mm')}
        <span className="text-3xl text-gray-400">:{format(now, 'ss')}</span>
      </p>
      <p className="text-sm text-gray-500 mb-8">{format(now, 'EEEE, MMMM d, yyyy')}</p>

      {!status.checked_in ? (
        /* ── Not clocked in ── */
        <div className="w-full flex flex-col items-center gap-4">
          {/* Location toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['office', 'remote'] as const).map((loc) => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                className={`px-5 py-2 text-sm font-medium transition-colors capitalize ${
                  location === loc
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          <button
            onClick={() => clockIn()}
            disabled={clockingIn}
            className={`flex items-center justify-center gap-2 w-full max-w-xs py-4 rounded-xl
              text-white font-semibold text-base bg-green-600 hover:bg-green-700
              transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {clockingIn ? (
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <LogIn size={20} />
            )}
            Clock In
          </button>

          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin size={13} className="text-gray-400" />
            <span className="capitalize">{location}</span>
          </div>
        </div>
      ) : (
        /* ── Clocked in ── */
        <div className="w-full flex flex-col items-center gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 w-full max-w-xs">
            <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Checked in at</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">
              {status.check_in_time?.slice(0, 5) ?? '--:--'}
            </p>
            {duration && (
              <p className="text-sm text-green-600 mt-1 tabular-nums">
                {duration} elapsed
              </p>
            )}
          </div>

          {!status.check_out_time ? (
            <button
              onClick={() => clockOut()}
              disabled={clockingOut}
              className={`flex items-center justify-center gap-2 w-full max-w-xs py-4 rounded-xl
                text-white font-semibold text-base bg-red-500 hover:bg-red-600
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {clockingOut ? (
                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <LogOut size={20} />
              )}
              Clock Out
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-3 w-full max-w-xs text-center">
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Work hours today</p>
              <p className="text-2xl font-bold text-blue-700">
                {status.working_hours?.toFixed(1) ?? '0.0'}h
              </p>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin size={13} className="text-gray-400" />
            <span className="capitalize">{status.location ?? 'office'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────
const AttendanceCalendar = ({ records }: { records: Attendance[] }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selected, setSelected]         = useState<Attendance | null>(null)

  const recordMap = new Map(records.map((r) => [r.date, r]))

  const days     = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startDay = (getDay(days[0]) + 6) % 7   // Mon = 0

  const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="card p-5">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
            disabled={isSameMonth(currentMonth, new Date())}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDay }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const record  = recordMap.get(dateStr)
          const isWeekend = [0, 6].includes(getDay(day))
          const status  = record?.status ?? (isWeekend ? 'weekend' : undefined)
          const isSelected = selected?.date === dateStr

          return (
            <button
              key={dateStr}
              onClick={() => record && setSelected(isSelected ? null : record)}
              className={`relative flex flex-col items-center py-1.5 rounded-lg transition-colors
                ${record ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}
                ${isToday(day) ? 'ring-2 ring-blue-500' : ''}
                ${isSelected ? 'bg-blue-50' : ''}`}
            >
              <span className={`text-xs font-medium mb-1 ${
                isToday(day) ? 'text-blue-600' : 'text-gray-700'
              }`}>
                {format(day, 'd')}
              </span>
              {status && (
                <span className={`w-2 h-2 rounded-full ${DOT_COLORS[status] ?? 'bg-gray-300'}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Popover for selected day */}
      {selected && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800">
              {formatDate(selected.date, 'EEEE, MMM d')}
            </p>
            <Badge
              label={selected.status}
              className={ATTENDANCE_STATUS_COLORS[selected.status] ?? 'bg-gray-100 text-gray-600'}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400">Check In</p>
              <p className="text-sm font-medium text-gray-800">{selected.check_in?.slice(0, 5) ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Check Out</p>
              <p className="text-sm font-medium text-gray-800">{selected.check_out?.slice(0, 5) ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Hours</p>
              <p className="text-sm font-medium text-gray-800">
                {selected.working_hours ? `${selected.working_hours}h` : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            <span className="text-xs text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Monthly summary ───────────────────────────────────────────────────────────
const MonthlySummary = ({ summary }: { summary: import('@/types/attendance.types').AttendanceSummary }) => {
  const items = [
    { label: 'Working Days',  value: summary.working_days ?? 0,                          color: 'text-gray-900' },
    { label: 'Present',       value: summary.present,                                     color: 'text-green-600' },
    { label: 'Absent',        value: summary.absent,                                      color: 'text-red-600' },
    { label: 'Late Arrivals', value: summary.late,                                        color: 'text-amber-600' },
    { label: 'Avg Hours/Day', value: `${(summary.avg_working_hours ?? 0).toFixed(1)}h`,  color: 'text-blue-600' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
      {items.map((item) => (
        <div key={item.label} className="card p-4 text-center">
          <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Regularizations list ──────────────────────────────────────────────────────
const RegularizationList = ({ onNew }: { onNew: () => void }) => {
  const { data: regs = [], isLoading } = useQuery({
    queryKey: ['regularizations'],
    queryFn: attendanceService.getMyRegularizations,
  })

  const STATUS_COLORS: Record<string, string> = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">Regularization Requests</h3>
          <p className="text-xs text-gray-500 mt-0.5">Correction requests for attendance records</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={onNew}>
          New Request
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : regs.length === 0 ? (
        <EmptyState
          icon={<Calendar size={36} className="text-gray-300" />}
          title="No requests"
          description="You haven't submitted any regularization requests."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 rounded-l-lg">Date</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Check In</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Check Out</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Reason</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 rounded-r-lg">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {regs.map((reg: Regularization) => (
                <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 font-medium text-gray-800">
                    {formatDate(reg.date, 'MMM d, yyyy')}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{reg.check_in}</td>
                  <td className="px-3 py-3 text-gray-600">{reg.check_out}</td>
                  <td className="px-3 py-3 text-gray-500 max-w-[200px] truncate">{reg.reason}</td>
                  <td className="px-3 py-3">
                    <Badge label={reg.status} className={STATUS_COLORS[reg.status] ?? 'bg-gray-100 text-gray-600'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const MyAttendance = () => {
  const { user } = useAuth()
  const [regModalOpen, setRegModalOpen] = useState(false)
  const [month] = useState(new Date().getMonth() + 1)
  const [year]  = useState(new Date().getFullYear())

  const { data: todayStatus, refetch: refetchToday } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: attendanceService.getTodayStatus,
    staleTime: 1000 * 30,
  })

  const { data: records = [] } = useQuery({
    queryKey: ['attendance', 'my', month, year],
    queryFn: () => attendanceService.getMyAttendance(month, year),
    enabled: !!user,
  })

  const { data: summary } = useQuery({
    queryKey: ['attendance', 'summary', user?.id, month, year],
    queryFn: () => attendanceService.getMonthSummary(user!.id, month, year),
    enabled: !!user,
  })

  const defaultToday: TodayStatus = { checked_in: false }

  return (
    <div className="space-y-5">
      {/* Today card */}
      <TodayCard
        status={todayStatus ?? defaultToday}
        onStatusChange={refetchToday}
      />

      {/* Monthly summary */}
      {summary && <MonthlySummary summary={summary} />}

      {/* Calendar */}
      <AttendanceCalendar records={records} />

      {/* Regularizations */}
      <RegularizationList onNew={() => setRegModalOpen(true)} />

      {/* Regularization modal */}
      <RegularizationForm
        open={regModalOpen}
        onClose={() => setRegModalOpen(false)}
      />
    </div>
  )
}

export default MyAttendance
