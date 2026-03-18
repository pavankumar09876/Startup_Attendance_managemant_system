/**
 * AttendanceHeatmap — GitHub-style yearly attendance grid.
 * Shows 52 weeks × 7 days. Cell color = attendance status.
 */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { attendanceService } from '@/services/attendance.service'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'
import { Skeleton } from '@/components/common/Skeleton'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS   = ['','Mon','','Wed','','Fri','']

type StatusColor = Record<string, string>
const STATUS_BG: StatusColor = {
  present:  'bg-green-500',
  late:     'bg-yellow-400',
  absent:   'bg-red-400',
  half_day: 'bg-orange-300',
  on_leave: 'bg-blue-400',
  holiday:  'bg-purple-400',
  weekend:  'bg-gray-100 dark:bg-gray-800',
  wfh:      'bg-teal-400',
  none:     'bg-gray-100 dark:bg-gray-700',
}

const STATUS_LABEL: StatusColor = {
  present:  'Present',
  late:     'Late',
  absent:   'Absent',
  half_day: 'Half Day',
  on_leave: 'On Leave',
  holiday:  'Holiday',
  weekend:  'Weekend',
  wfh:      'Work From Home',
  none:     'No data',
}

interface DayCell {
  date:   string     // YYYY-MM-DD
  status: string
  dayOfWeek: number  // 0=Sun…6=Sat
}

const isoWeek = (d: Date) => {
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const diff = (d.getTime() - jan1.getTime()) / 86400000
  return Math.ceil((diff + jan1.getDay() + 1) / 7)
}

const AttendanceHeatmap = ({ employeeId }: { employeeId?: string }) => {
  const { user } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [tooltip, setTooltip] = useState<{ date: string; status: string; x: number; y: number } | null>(null)

  const empId = employeeId ?? (user?.id as string)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance-heatmap', empId, year],
    queryFn: () =>
      attendanceService.getByRange(`${year}-01-01`, `${year}-12-31`, empId),
    enabled: !!empId,
    staleTime: 1000 * 60 * 10,
  })

  // Build lookup map: date→status
  const statusMap: Record<string, string> = {}
  records.forEach((r: any) => { statusMap[r.date] = r.status })

  // Build grid: 53 cols (weeks) × 7 rows (days)
  const jan1 = new Date(year, 0, 1)
  const startDow = jan1.getDay()   // 0=Sun
  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365

  const cells: (DayCell | null)[][] = Array.from({ length: 53 }, () => Array(7).fill(null))

  for (let d = 0; d < daysInYear; d++) {
    const date = new Date(year, 0, d + 1)
    const dow  = date.getDay()   // 0=Sun
    const col  = Math.floor((d + startDow) / 7)
    const iso  = date.toISOString().slice(0, 10)
    if (col < 53) {
      cells[col][dow] = { date: iso, status: statusMap[iso] ?? (dow === 0 || dow === 6 ? 'weekend' : 'none'), dayOfWeek: dow }
    }
  }

  // Month label positions (first Sunday of each month)
  const monthPositions: { label: string; col: number }[] = []
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1)
    const col = Math.floor((d.getDay() + (new Date(year, 0, 1).getDay()) + (m === 0 ? 0 : new Date(year, 0, 0).getDate() + /* TODO */ 0)) / 7)
    const offset = Math.floor(d.getTime() / 86400000) - Math.floor(jan1.getTime() / 86400000)
    const weekCol = Math.floor((offset + startDow) / 7)
    if (weekCol < 53) monthPositions.push({ label: MONTH_LABELS[m], col: weekCol })
  }

  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-xl" />
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Yearly Attendance</h3>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1
            bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
        >
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Month labels */}
      <div className="relative overflow-x-auto">
        <div className="flex ml-7 mb-1 gap-[3px]">
          {monthPositions.map((mp, i) => (
            <div
              key={i}
              className="text-[10px] text-gray-400 dark:text-gray-500 absolute"
              style={{ left: `${28 + mp.col * 14}px` }}
            >
              {mp.label}
            </div>
          ))}
        </div>

        <div className="flex gap-[3px] mt-4">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="h-[11px] text-[9px] text-gray-400 dark:text-gray-500 leading-[11px]">{d}</div>
            ))}
          </div>

          {/* Week columns */}
          {cells.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => (
                <div
                  key={di}
                  onMouseEnter={(e) => cell && setTooltip({
                    date: cell.date,
                    status: STATUS_LABEL[cell.status] ?? cell.status,
                    x: e.clientX,
                    y: e.clientY,
                  })}
                  onMouseLeave={() => setTooltip(null)}
                  className={cn(
                    'w-[11px] h-[11px] rounded-[2px] cursor-default',
                    cell ? STATUS_BG[cell.status] ?? STATUS_BG.none : 'bg-transparent',
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'none' && k !== 'weekend').map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className={cn('w-2.5 h-2.5 rounded-[2px]', STATUS_BG[k])} />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{v}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 32 }}
        >
          <span className="font-medium">{tooltip.date}</span> — {tooltip.status}
        </div>
      )}
    </div>
  )
}

export default AttendanceHeatmap
