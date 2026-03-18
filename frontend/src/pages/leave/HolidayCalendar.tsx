import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isToday, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, LayoutGrid, List, Calendar } from 'lucide-react'

import { leaveService } from '@/services/leave.service'
import type { Holiday } from '@/types/leave.types'
import { formatDate } from '@/utils/formatDate'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'

// ── Static holiday seed (used when API returns empty) ─────────────────────────
const STATIC_HOLIDAYS: Holiday[] = [
  { id: '1',  name: "New Year's Day",       date: '2026-01-01', type: 'public' },
  { id: '2',  name: 'Republic Day',          date: '2026-01-26', type: 'public' },
  { id: '3',  name: 'Holi',                  date: '2026-03-04', type: 'public' },
  { id: '4',  name: 'Good Friday',           date: '2026-04-03', type: 'public' },
  { id: '5',  name: 'Independence Day',      date: '2026-08-15', type: 'public' },
  { id: '6',  name: 'Gandhi Jayanti',        date: '2026-10-02', type: 'public' },
  { id: '7',  name: 'Diwali',                date: '2026-10-19', type: 'public' },
  { id: '8',  name: 'Christmas Day',         date: '2026-12-25', type: 'public' },
  { id: '9',  name: 'Company Foundation Day',date: '2026-03-15', type: 'company' },
  { id: '10', name: 'Team Building Day',     date: '2026-06-20', type: 'company' },
]

type ViewMode = 'grid' | 'list'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Grid view ─────────────────────────────────────────────────────────────────
const GridView = ({
  currentMonth,
  holidayMap,
}: {
  currentMonth: Date
  holidayMap: Map<string, Holiday>
}) => {
  const [tooltip, setTooltip] = useState<string | null>(null)

  const days     = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const startDay = (getDay(days[0]) + 6) % 7   // Mon = 0

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-2">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDay }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const dateStr   = format(day, 'yyyy-MM-dd')
          const holiday   = holidayMap.get(dateStr)
          const isWeekend = [0, 6].includes(getDay(day))
          const isToday_  = isToday(day)

          return (
            <div
              key={dateStr}
              onMouseEnter={() => holiday && setTooltip(dateStr)}
              onMouseLeave={() => setTooltip(null)}
              className={cn(
                'relative flex flex-col items-center justify-center min-h-[52px] rounded-lg p-1 transition-colors',
                isToday_ && 'ring-2 ring-blue-500',
                holiday?.type === 'public'  && 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700',
                holiday?.type === 'company' && 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700',
                isWeekend && !holiday       && 'bg-gray-50 dark:bg-gray-800',
                !holiday && !isWeekend      && 'hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  isToday_              && 'text-blue-600',
                  holiday?.type === 'public'  && 'text-red-700 dark:text-red-400',
                  holiday?.type === 'company' && 'text-amber-700 dark:text-amber-400',
                  isWeekend && !holiday && 'text-gray-400 dark:text-gray-500',
                  !holiday && !isWeekend && !isToday_ && 'text-gray-700 dark:text-gray-200',
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Holiday name label */}
              {holiday && (
                <span
                  className={cn(
                    'text-[9px] font-medium leading-tight text-center px-0.5 truncate w-full',
                    holiday.type === 'public'  ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
                  )}
                >
                  {holiday.name}
                </span>
              )}

              {/* Tooltip on hover for long names */}
              {tooltip === dateStr && holiday && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10
                  bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap pointer-events-none">
                  {holiday.name}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────
const ListView = ({ holidays }: { holidays: Holiday[] }) => {
  if (holidays.length === 0) {
    return (
      <EmptyState
        icon={<Calendar size={36} className="text-gray-300 dark:text-gray-600" />}
        title="No holidays"
        description="No holidays scheduled for this month."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {['Date', 'Day', 'Holiday Name', 'Type'].map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {holidays.map((h) => (
            <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                {formatDate(h.date, 'MMM d, yyyy')}
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                {format(parseISO(h.date), 'EEEE')}
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  'font-medium',
                  h.type === 'public' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400',
                )}>
                  {h.name}
                </span>
                {h.description && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{h.description}</p>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  h.type === 'public'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700',
                )}>
                  {h.type === 'public' ? 'Public Holiday' : 'Company Holiday'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const HolidayCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode]          = useState<ViewMode>('grid')

  const year = currentMonth.getFullYear()

  const { data: apiHolidays = [] } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => leaveService.getHolidays(year),
    staleTime: 1000 * 60 * 60,   // 1 hour
  })

  // Fall back to static if API returns nothing
  const holidays: Holiday[] = apiHolidays.length > 0 ? apiHolidays : STATIC_HOLIDAYS

  // Filter to current month for list view
  const monthHolidays = useMemo(() => {
    const m = format(currentMonth, 'yyyy-MM')
    return holidays
      .filter((h) => h.date.startsWith(m))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [holidays, currentMonth])

  // Build map for quick lookup in grid view
  const holidayMap = useMemo(
    () => new Map(holidays.map((h) => [h.date, h])),
    [holidays],
  )

  const prevMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))

  // Year-wide count
  const publicCount  = holidays.filter((h) => h.type === 'public').length
  const companyCount = holidays.filter((h) => h.type === 'company').length

  return (
    <div className="space-y-4">
      {/* ── Year summary strip ──────────────────────────────── */}
      <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          <strong className="text-gray-900 dark:text-white">{year}</strong> holidays:
        </span>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-gray-600 dark:text-gray-300">{publicCount} Public</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-gray-600 dark:text-gray-300">{companyCount} Company</span>
        </div>
        <span className="text-gray-400 dark:text-gray-500">|</span>
        <span className="text-gray-600 dark:text-gray-300">Total: <strong className="text-gray-900 dark:text-white">{publicCount + companyCount}</strong></span>
      </div>

      <div className="card p-5">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white min-w-[150px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              Today
            </button>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {([
              { id: 'grid' as ViewMode, icon: <LayoutGrid size={15} /> },
              { id: 'list' as ViewMode, icon: <List size={15} /> },
            ]).map(({ id, icon }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  viewMode === id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────── */}
        {viewMode === 'grid' ? (
          <GridView currentMonth={currentMonth} holidayMap={holidayMap} />
        ) : (
          <ListView holidays={monthHolidays} />
        )}

        {/* ── Legend ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-5 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-gray-500 dark:text-gray-400">Public Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-gray-500 dark:text-gray-400">Company Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span className="text-gray-500 dark:text-gray-400">Weekend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-blue-500 bg-white dark:bg-gray-900" />
            <span className="text-gray-500 dark:text-gray-400">Today</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HolidayCalendar
