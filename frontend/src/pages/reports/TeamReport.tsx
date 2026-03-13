import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Download } from 'lucide-react'

import { reportsService } from '@/services/reports.service'
import { staffService } from '@/services/staff.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2']

// ── Utilization gauge colors ───────────────────────────────────────────────────
const utilizationColor = (pct: number) => {
  if (pct >= 90) return 'text-green-700'
  if (pct >= 70) return 'text-blue-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}
const utilizationBar = (pct: number) => {
  if (pct >= 90) return 'bg-green-500'
  if (pct >= 70) return 'bg-blue-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Custom PieChart label ────────────────────────────────────────────────────
const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  const r  = innerRadius + (outerRadius - innerRadius) * 0.5
  const x  = cx + r * Math.cos(-midAngle * RADIAN)
  const y  = cy + r * Math.sin(-midAngle * RADIAN)
  return percent > 0.06 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null
}

const TeamReport = () => {
  const now = new Date()
  const [month, setMonth]    = useState(now.getMonth() + 1)
  const [year,  setYear]     = useState(now.getFullYear())
  const [empId, setEmpId]    = useState('')

  const currentYear = now.getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => staffService.getEmployees({ limit: 200 }).then((d) => d.users ?? []),
    staleTime: 1000 * 60 * 5,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['report-team', month, year, empId],
    queryFn: () =>
      reportsService.getTeamReport({
        month:       month,
        year:        year,
        employee_id: empId || undefined,
      }),
    staleTime: 1000 * 60 * 2,
  })

  const handleExport = async () => {
    try {
      const blob = await reportsService.exportCSV('team', { month, year })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `team-report-${MONTHS[month - 1]}-${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Employee (for allocation)</label>
            <select
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
            >
              <option value="">All Employees</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.full_name ?? `${e.first_name} ${e.last_name}`}
                </option>
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Utilization bar chart */}
            <div className="card p-5 xl:col-span-2">
              <p className="text-sm font-semibold text-gray-800 mb-4">Team Utilization — Hours Logged vs Expected</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data?.utilization ?? []}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="employee_name"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v.split(' ')[0]}
                  />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: number) => [`${v}h`]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="hours_logged"   name="Logged"   fill={COLORS[0]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expected_hours" name="Expected" fill="#e5e7eb"   radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Project allocation pie */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-800 mb-1">Project Allocation</p>
              <p className="text-xs text-gray-400 mb-3">
                {empId ? employees.find((e: any) => e.id === empId)?.first_name ?? 'Selected employee' : 'All employees'}
              </p>
              {(data?.allocation?.length ?? 0) === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={data?.allocation ?? []}
                      dataKey="hours"
                      nameKey="project"
                      cx="50%"
                      cy="50%"
                      outerRadius={72}
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {(data?.allocation ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(v: number) => [`${v}h`]}
                    />
                    <Legend
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value) => value.length > 18 ? value.slice(0, 18) + '…' : value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Productivity trend */}
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-800 mb-4">Weekly Productivity — Tasks Completed</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.productivity_trend ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Line
                  type="monotone"
                  dataKey="tasks_completed"
                  name="Tasks Completed"
                  stroke={COLORS[4]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: COLORS[4] }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Utilization table ──────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Team Utilization Detail</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {MONTHS[month - 1]} {year} · {data?.utilization?.length ?? 0} members
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Employee', 'Department', 'Hours This Month', 'Utilization', 'Projects', 'Tasks Done', 'Avg Daily Hrs'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.utilization ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                        No utilization data for this period.
                      </td>
                    </tr>
                  ) : (
                    (data?.utilization ?? []).map((row) => (
                      <tr key={row.employee_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.employee_name}</td>
                        <td className="px-4 py-3 text-gray-500">{row.department}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">{row.hours_logged}h</span>
                          <span className="text-gray-400 text-xs"> / {row.expected_hours}h</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div
                                className={cn('h-1.5 rounded-full', utilizationBar(row.utilization_pct))}
                                style={{ width: `${Math.min(row.utilization_pct, 100)}%` }}
                              />
                            </div>
                            <span className={cn('text-xs font-semibold', utilizationColor(row.utilization_pct))}>
                              {row.utilization_pct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.projects_count}</td>
                        <td className="px-4 py-3 text-gray-700">{row.tasks_done}</td>
                        <td className="px-4 py-3 text-gray-700">{row.avg_daily_hours.toFixed(1)}h</td>
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

export default TeamReport
