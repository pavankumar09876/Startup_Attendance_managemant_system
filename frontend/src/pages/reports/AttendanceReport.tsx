import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Download, Search, ChevronUp, ChevronDown } from 'lucide-react'

import { reportsService } from '@/services/reports.service'
import type { AttendanceSummaryRow, HeatmapCell } from '@/services/reports.service'
import { staffService } from '@/services/staff.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const COLORS = ['#2563EB', '#DC2626', '#D97706', '#16A34A', '#7C3AED', '#0891B2']

// ── Heatmap cell ─────────────────────────────────────────────────────────────
const CELL_COLOR: Record<HeatmapCell['status'], string> = {
  on_time:     'bg-green-500',
  slight_late: 'bg-amber-400',
  very_late:   'bg-red-500',
  absent:      'bg-gray-200',
  weekend:     'bg-gray-50 border border-dashed border-gray-200',
}

const CELL_TOOLTIP: Record<HeatmapCell['status'], string> = {
  on_time:     'On time',
  slight_late: 'Slightly late',
  very_late:   'Very late',
  absent:      'Absent',
  weekend:     'Weekend',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Sort helper ──────────────────────────────────────────────────────────────
type SortKey = keyof AttendanceSummaryRow
type SortDir = 'asc' | 'desc'

const AttendanceReport = () => {
  const today     = new Date()
  const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [startDate, setStartDate] = useState(thirtyAgo.toISOString().slice(0, 10))
  const [endDate,   setEndDate]   = useState(today.toISOString().slice(0, 10))
  const [deptId,    setDeptId]    = useState('')
  const [empId,     setEmpId]     = useState('')
  const [search,    setSearch]    = useState('')
  const [sortKey,   setSortKey]   = useState<SortKey>('employee_name')
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: staffService.getDepartments,
    staleTime: 1000 * 60 * 5,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['report-attendance', startDate, endDate, deptId, empId],
    queryFn: () =>
      reportsService.getAttendanceReport({
        start_date:    startDate,
        end_date:      endDate,
        department_id: deptId   || undefined,
        employee_id:   empId    || undefined,
      }),
    staleTime: 1000 * 60 * 2,
  })

  const handleExport = async () => {
    try {
      const blob = await reportsService.exportCSV('attendance', {
        start_date: startDate, end_date: endDate,
        department_id: deptId || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `attendance-report-${startDate}-${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedRows = useMemo(() => {
    const rows = (data?.summary ?? []).filter((r) =>
      r.employee_name.toLowerCase().includes(search.toLowerCase()),
    )
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [data?.summary, search, sortKey, sortDir])

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
    ) : (
      <ChevronUp size={12} className="opacity-30" />
    )

  // Group heatmap cells by week
  const heatmapWeeks = useMemo(() => {
    const cells = data?.heatmap ?? []
    const maxWeek = Math.max(...cells.map((c) => c.week), 0)
    const weeks: (HeatmapCell | null)[][] = []
    for (let w = 0; w <= maxWeek; w++) {
      const row: (HeatmapCell | null)[] = Array(7).fill(null)
      cells.filter((c) => c.week === w).forEach((c) => { row[c.day] = c })
      weeks.push(row)
    }
    return weeks
  }, [data?.heatmap])

  return (
    <div className="space-y-6">
      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Department</label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto mt-4">
            <Button variant="secondary" leftIcon={<Download size={14} />} onClick={handleExport}>
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-72 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Charts row ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Attendance trend */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Attendance Trend (Last 30 Days)</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.trend ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[3]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS[3]} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[2]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS[2]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    labelFormatter={(v) => `Date: ${v}`}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="present" name="Present" stroke={COLORS[0]} fill="url(#colorPresent)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="absent"  name="Absent"  stroke={COLORS[3]} fill="url(#colorAbsent)"  strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="late"    name="Late"    stroke={COLORS[2]} fill="url(#colorLate)"    strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Department-wise */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Department-wise Attendance %</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.by_department ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="present_pct" name="Present" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="absent_pct"  name="Absent"  fill={COLORS[3]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="late_pct"    name="Late"    fill={COLORS[2]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Late arrivals heatmap ─────────────────────────── */}
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-800 mb-1">Late Arrivals Heatmap</p>
            <p className="text-xs text-gray-400 mb-4">Each cell = one day. Green = on time · Amber = slightly late · Red = very late · Gray = absent</p>
            <div className="overflow-x-auto">
              {/* Day labels */}
              <div className="flex gap-1 mb-1 ml-12">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="w-7 text-center text-[10px] text-gray-400 font-medium">{d}</div>
                ))}
              </div>
              {heatmapWeeks.length > 0 ? (
                heatmapWeeks.map((week, wi) => (
                  <div key={wi} className="flex items-center gap-1 mb-1">
                    <div className="w-10 text-[10px] text-gray-400 text-right pr-1">
                      {week.find((c) => c)?.date?.slice(5, 10) ?? ''}
                    </div>
                    {week.map((cell, di) => (
                      <div
                        key={di}
                        title={cell ? `${cell.date}${cell.arrival_time ? ` — ${cell.arrival_time}` : ''} (${CELL_TOOLTIP[cell.status]})` : ''}
                        className={cn(
                          'w-7 h-7 rounded-sm transition-transform hover:scale-110 cursor-default',
                          cell ? CELL_COLOR[cell.status] : 'bg-gray-100',
                        )}
                      />
                    ))}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 py-4 text-center">No heatmap data for this period.</p>
              )}
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3">
                {Object.entries(CELL_TOOLTIP).filter(([k]) => k !== 'weekend').map(([status, label]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className={cn('w-3 h-3 rounded-sm', CELL_COLOR[status as HeatmapCell['status']])} />
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Summary table ────────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Employee Summary</p>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee…"
                  className="pl-7 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {(
                      [
                        ['employee_name', 'Employee'],
                        ['department', 'Department'],
                        ['total_days', 'Days'],
                        ['present', 'Present'],
                        ['absent', 'Absent'],
                        ['late', 'Late'],
                        ['wfh', 'WFH'],
                        ['leave', 'Leave'],
                        ['attendance_pct', 'Attendance %'],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => toggleSort(key)}
                        className="text-left px-4 py-3 text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-800"
                      >
                        <div className="flex items-center gap-1">
                          {label}
                          <SortIcon col={key} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-sm text-gray-400">
                        No data for selected filters.
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row) => (
                      <tr key={row.employee_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.employee_name}</td>
                        <td className="px-4 py-3 text-gray-500">{row.department}</td>
                        <td className="px-4 py-3 text-gray-700">{row.total_days}</td>
                        <td className="px-4 py-3 text-green-700 font-medium">{row.present}</td>
                        <td className="px-4 py-3 text-red-600">{row.absent}</td>
                        <td className="px-4 py-3 text-amber-600">{row.late}</td>
                        <td className="px-4 py-3 text-blue-600">{row.wfh}</td>
                        <td className="px-4 py-3 text-purple-600">{row.leave}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                              <div
                                className={cn(
                                  'h-1.5 rounded-full',
                                  row.attendance_pct >= 90 ? 'bg-green-500' :
                                  row.attendance_pct >= 75 ? 'bg-amber-500' : 'bg-red-500',
                                )}
                                style={{ width: `${Math.min(row.attendance_pct, 100)}%` }}
                              />
                            </div>
                            <span className={cn(
                              'text-xs font-semibold',
                              row.attendance_pct >= 90 ? 'text-green-700' :
                              row.attendance_pct >= 75 ? 'text-amber-700' : 'text-red-600',
                            )}>
                              {row.attendance_pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AttendanceReport
