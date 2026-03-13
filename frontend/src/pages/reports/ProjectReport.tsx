import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Download } from 'lucide-react'

import { reportsService } from '@/services/reports.service'
import type { ProjectProgressRow } from '@/services/reports.service'
import { projectService } from '@/services/project.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2']

const STATUS_COLORS: Record<string, string> = {
  active:      '#2563EB',
  in_progress: '#0891B2',
  planning:    '#7C3AED',
  on_hold:     '#D97706',
  completed:   '#16A34A',
  cancelled:   '#DC2626',
}

const HEALTH_CONFIG = {
  on_track: { label: 'On Track', cls: 'bg-green-100 text-green-700' },
  at_risk:  { label: 'At Risk',  cls: 'bg-amber-100 text-amber-700' },
  delayed:  { label: 'Delayed',  cls: 'bg-red-100 text-red-600' },
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n)

// ── Custom horizontal bar for project progress ────────────────────────────────
const ProgressBar = ({ value, status }: { value: number; status: string }) => (
  <div className="flex items-center gap-2 min-w-[120px]">
    <div className="flex-1 bg-gray-100 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: STATUS_COLORS[status] ?? COLORS[0] }}
      />
    </div>
    <span className="text-xs font-semibold text-gray-700 w-9 text-right">{value}%</span>
  </div>
)

const ProjectReport = () => {
  const today     = new Date()
  const sixMonths = new Date(today.getFullYear(), today.getMonth() - 5, 1)

  const [projectId, setProjectId] = useState('')
  const [status,    setStatus]    = useState('')
  const [startDate, setStartDate] = useState(sixMonths.toISOString().slice(0, 10))
  const [endDate,   setEndDate]   = useState(today.toISOString().slice(0, 10))

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => projectService.list({ limit: 200 }).then((d) => d.projects ?? []),
    staleTime: 1000 * 60 * 5,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['report-projects', projectId, status, startDate, endDate],
    queryFn: () =>
      reportsService.getProjectReport({
        project_id: projectId || undefined,
        status:     status    || undefined,
        start_date: startDate,
        end_date:   endDate,
      }),
    staleTime: 1000 * 60 * 2,
  })

  const handleExport = async () => {
    try {
      const blob = await reportsService.exportCSV('projects', { project_id: projectId || undefined, status: status || undefined })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `project-report.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  // Pick up project names for the line chart from task_trend
  const trendProjects = data?.task_trend?.length
    ? Object.keys(data.task_trend[0]).filter((k) => k !== 'date')
    : []

  return (
    <div className="space-y-6">
      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Projects</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {['active', 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled'].map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
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
          {/* ── Charts ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Budget overview */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Budget Overview</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.budget_chart ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtINR(v)} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: number) => [fmtINR(v)]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="budget" name="Budgeted" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="spent"  name="Spent"    fill={COLORS[3]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Task completion trend */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">Task Completion Rate</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data?.task_trend ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  {trendProjects.map((proj, i) => (
                    <Line
                      key={proj}
                      type="monotone"
                      dataKey={proj}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Project health table ─────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Project Health</p>
              <p className="text-xs text-gray-400 mt-0.5">{data?.projects?.length ?? 0} projects</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Project', 'Status', 'Progress', 'Tasks', 'Budget', 'Team', 'Health'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.projects ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                        No project data for selected filters.
                      </td>
                    </tr>
                  ) : (
                    (data?.projects ?? []).map((proj) => {
                      const health = HEALTH_CONFIG[proj.health] ?? HEALTH_CONFIG.on_track
                      return (
                        <tr key={proj.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">
                            {proj.name}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                              style={{
                                backgroundColor: `${STATUS_COLORS[proj.status] ?? COLORS[0]}1a`,
                                color: STATUS_COLORS[proj.status] ?? COLORS[0],
                              }}
                            >
                              {proj.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <ProgressBar value={proj.progress} status={proj.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {proj.tasks_done}/{proj.tasks_total}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs">
                              <span className="text-gray-800 font-medium">{fmtINR(proj.spent)}</span>
                              <span className="text-gray-400"> / {fmtINR(proj.budget)}</span>
                            </div>
                            {proj.budget > 0 && (
                              <div className="w-20 bg-gray-100 rounded-full h-1 mt-1">
                                <div
                                  className={cn(
                                    'h-1 rounded-full',
                                    proj.spent / proj.budget > 0.9 ? 'bg-red-500' :
                                    proj.spent / proj.budget > 0.7 ? 'bg-amber-500' : 'bg-green-500',
                                  )}
                                  style={{ width: `${Math.min((proj.spent / proj.budget) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{proj.team_count}</td>
                          <td className="px-4 py-3">
                            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', health.cls)}>
                              {health.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })
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

export default ProjectReport
