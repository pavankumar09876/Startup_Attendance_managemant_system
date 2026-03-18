import {
  Users, CheckCircle2, CalendarOff, FolderOpen,
  UserX, Clock,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

import type { AdminStats } from '@/services/dashboard.service'
import { formatDate, timeAgo } from '@/utils/formatDate'
import { ATTENDANCE_STATUS_COLORS, LEAVE_STATUS_COLORS } from '@/constants/status'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'
import StatCard from './StatCard'

const PIE_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2']

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-4">
    <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h3>
    {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
  </div>
)

interface Props { data: AdminStats }

const AdminDashboard = ({ data }: Props) => (
  <div className="space-y-6">
    {/* ── Stat cards ─────────────────────────────────────────── */}
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="Total Employees"
        value={data.total_employees}
        subtext={`${data.active_employees} active`}
        icon={<Users size={18} />}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        trend={5}
        trendLabel="vs last month"
      />
      <StatCard
        label="Present Today"
        value={data.present_today}
        subtext={`${data.attendance_pct.toFixed(1)}% attendance rate`}
        icon={<CheckCircle2 size={18} />}
        iconBg="bg-green-100"
        iconColor="text-green-600"
        trend={data.attendance_pct >= 80 ? 3 : -4}
        trendLabel="vs last month"
      />
      <StatCard
        label="Pending Leaves"
        value={data.pending_leaves}
        subtext="Awaiting your approval"
        icon={<CalendarOff size={18} />}
        iconBg="bg-amber-100"
        iconColor="text-amber-600"
        trend={data.pending_leaves > 5 ? 8 : 0}
        trendLabel="vs last month"
      />
      <StatCard
        label="Open Projects"
        value={data.open_projects}
        subtext="Active right now"
        icon={<FolderOpen size={18} />}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        trend={2}
        trendLabel="vs last month"
      />
    </div>

    {/* ── Charts row 1 ───────────────────────────────────────── */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Attendance trend */}
      <div className="card p-5">
        <SectionTitle title="Attendance Trend" subtitle="Last 30 days — present vs absent" />
        {data.attendance_trend.length === 0 ? (
          <EmptyState title="No data yet" description="Attendance records will appear here." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.attendance_trend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickFormatter={(v) => formatDate(v, 'MMM d')}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                labelFormatter={(v) => formatDate(v as string, 'MMM d, yyyy')}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="present" stroke="#16A34A" strokeWidth={2} dot={false} name="Present" />
              <Line type="monotone" dataKey="absent"  stroke="#DC2626" strokeWidth={2} dot={false} name="Absent" />
              <Line type="monotone" dataKey="late"    stroke="#D97706" strokeWidth={2} dot={false} name="Late" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Department headcount */}
      <div className="card p-5">
        <SectionTitle title="Department Headcount" subtitle="Employees per department" />
        {data.dept_headcount.length === 0 ? (
          <EmptyState title="No departments" description="Add departments to see data here." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.dept_headcount} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>

    {/* ── Charts row 2 + tables ────────────────────────────────── */}
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Leave distribution pie */}
      <div className="card p-5">
        <SectionTitle title="Leave Distribution" subtitle="By type this month" />
        {data.leave_distribution.length === 0 ? (
          <EmptyState title="No leaves" description="Leave requests will appear here." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.leave_distribution}
                dataKey="value"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={75}
                innerRadius={40}
                paddingAngle={3}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.leave_distribution.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Absent today */}
      <div className="card p-5">
        <SectionTitle title="Absent Today" subtitle={`${data.absent_today.length} employees`} />
        {data.absent_today.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={36} className="text-green-300" />}
            title="Full house!"
            description="Everyone is present today."
          />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.absent_today.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3 py-3">
                <Avatar name={emp.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{emp.department}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <UserX size={11} />
                  <span>{timeAgo(emp.last_seen)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending approvals */}
      <div className="card p-5">
        <SectionTitle title="Pending Approvals" subtitle="Requires your action" />
        {data.pending_approvals.length === 0 ? (
          <EmptyState title="All clear!" description="No pending approvals." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.pending_approvals.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <Avatar name={item.employee} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.employee}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      label={item.type}
                      className="bg-amber-100 text-amber-700"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={11} />
                  <span>{timeAgo(item.since)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ── Recent activity ─────────────────────────────────────── */}
    <div className="card p-5">
      <SectionTitle title="Recent Activity" subtitle="Latest actions across the platform" />
      {data.recent_activity.length === 0 ? (
        <EmptyState title="No activity yet" description="Activity will appear here." />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {data.recent_activity.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3">
              <Avatar name={item.user} src={item.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-gray-900 dark:text-white">{item.user}</span>
                  {' '}{item.action}
                </p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(item.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* ── Sprint Velocity ──────────────────────────────────────── */}
    <div className="card p-5">
      <SectionTitle title="Sprint Velocity" subtitle="Story points committed vs completed" />
      {data.sprint_velocity.length === 0 ? (
        <EmptyState title="No sprints yet" description="Complete sprints will show here." />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.sprint_velocity} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="capacity"  fill="#BFDBFE" radius={[4,4,0,0]} name="Committed" />
            <Bar dataKey="completed" fill="#2563EB" radius={[4,4,0,0]} name="Completed" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
)

export default AdminDashboard
