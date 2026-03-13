import {
  FolderKanban, AlertTriangle, Users, Wallet,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'

import type { ManagerStats } from '@/services/dashboard.service'
import { formatDate } from '@/utils/formatDate'
import { PROJECT_STATUS_COLORS, TASK_PRIORITY_COLORS } from '@/constants/status'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'
import StatCard from './StatCard'

const PIE_COLORS: Record<string, string> = {
  todo:        '#6B7280',
  in_progress: '#2563EB',
  in_review:   '#D97706',
  done:        '#16A34A',
}

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-4">
    <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
    {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
)

// Progress bar
const ProgressBar = ({ value }: { value: number }) => (
  <div className="w-full">
    <div className="flex justify-between mb-0.5">
      <span className="text-xs text-gray-400">{value}%</span>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full bg-blue-500 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
)

interface Props { data: ManagerStats }

const ManagerDashboard = ({ data }: Props) => (
  <div className="space-y-6">
    {/* ── Stat cards ─────────────────────────────────────────── */}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="My Projects"
        value={data.my_projects}
        subtext="Active projects"
        icon={<FolderKanban size={18} />}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        trend={2}
        trendLabel="vs last month"
      />
      <StatCard
        label="Tasks Due Today"
        value={data.tasks_due_today}
        subtext="Overdue or due now"
        icon={<AlertTriangle size={18} />}
        iconBg="bg-red-100"
        iconColor="text-red-600"
        trend={data.tasks_due_today > 3 ? 15 : -5}
        trendLabel="vs yesterday"
      />
      <StatCard
        label="Team Members"
        value={data.team_members}
        subtext="Across all projects"
        icon={<Users size={18} />}
        iconBg="bg-green-100"
        iconColor="text-green-600"
      />
      <StatCard
        label="Budget Used"
        value={`${data.budget_used_pct.toFixed(1)}%`}
        subtext="Of total allocated budget"
        icon={<Wallet size={18} />}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        trend={data.budget_used_pct > 80 ? 8 : 0}
        trendLabel="vs last month"
      />
    </div>

    {/* ── Charts row ─────────────────────────────────────────── */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Project progress - horizontal bar */}
      <div className="card p-5">
        <SectionTitle title="Project Progress" subtitle="% completion per project" />
        {data.project_progress.length === 0 ? (
          <EmptyState title="No projects" description="Create a project to see progress." />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, data.project_progress.length * 44)}>
            <BarChart
              data={data.project_progress}
              layout="vertical"
              margin={{ top: 4, right: 40, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: '#374151' }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, 'Progress']}
              />
              <Bar dataKey="progress" fill="#2563EB" radius={[0, 4, 4, 0]} name="Progress" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Task status donut */}
      <div className="card p-5">
        <SectionTitle title="Task Status Breakdown" subtitle="Across all my projects" />
        {data.task_breakdown.length === 0 ? (
          <EmptyState title="No tasks" description="Tasks will appear here once created." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.task_breakdown}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                paddingAngle={3}
              >
                {data.task_breakdown.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={PIE_COLORS[entry.status] ?? '#94A3B8'}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(v: string) => v.replace(/_/g, ' ')}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>

    {/* ── Tables row ─────────────────────────────────────────── */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* At risk tasks */}
      <div className="card p-5">
        <SectionTitle title="At Risk Tasks" subtitle="Overdue or approaching deadline" />
        {data.at_risk_tasks.length === 0 ? (
          <EmptyState title="No at-risk tasks" description="All tasks are on track!" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 rounded-l-lg">Task</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Project</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">Due</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 rounded-r-lg">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.at_risk_tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-[160px]">{task.title}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-500 truncate max-w-[100px]">{task.project}</td>
                    <td className="px-3 py-3">
                      <span className="text-red-600 font-medium text-xs">
                        {formatDate(task.due_date, 'MMM d')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-500 truncate max-w-[100px]">{task.assignee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My projects table */}
      <div className="card p-5">
        <SectionTitle title="My Projects" subtitle="Status overview" />
        {data.project_progress.length === 0 ? (
          <EmptyState title="No projects" description="You have no active projects." />
        ) : (
          <div className="divide-y divide-gray-100">
            {data.project_progress.map((proj) => (
              <div key={proj.id} className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{proj.name}</p>
                  <Badge
                    label={proj.status}
                    className={PROJECT_STATUS_COLORS[proj.status] ?? 'bg-gray-100 text-gray-600'}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={proj.progress} />
                  {proj.deadline && (
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatDate(proj.deadline, 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
)

export default ManagerDashboard
