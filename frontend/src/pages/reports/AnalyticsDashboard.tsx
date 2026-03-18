import { useQuery } from '@tanstack/react-query'
import {
  BarChart as RechartsBarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { reportsService } from '@/services/reports.service'

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#E11D48', '#0D9488']

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
  </div>
)

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-24 text-sm text-gray-400 dark:text-gray-500">
    {message}
  </div>
)

const HBarChart = ({ data, label, color = '#2563EB' }: { data: Record<string, number>; label: string; color?: string }) => {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, v]) => v), 1)

  if (entries.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{label}</h3>
        <EmptyState message="No data available" />
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{label}</h3>
      <div className="space-y-2">
        {entries.map(([key, val], i) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 dark:text-gray-300 w-28 truncate capitalize">{key.replace(/_/g, ' ')}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max((val / max) * 100, 2)}%`, backgroundColor: COLORS[i % COLORS.length] }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200 w-12 text-right">{typeof val === 'number' && val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const MonthlyTrendChart = ({ data, label, valueKey = 'value', format }: {
  data: Record<string, number | { gross: number; net: number; deductions: number }>
  label: string
  valueKey?: string
  format?: 'currency' | 'count'
}) => {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return null

  // Check if values are objects (payroll) or simple numbers
  const isComplex = typeof entries[0]?.[1] === 'object'

  const chartData = entries.map(([month, val]) => ({
    month: month.slice(5), // "2026-01" → "01"
    ...(isComplex ? (val as any) : { value: val as number }),
  }))

  const fmtValue = (v: number) =>
    format === 'currency' ? `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}` : v

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{label}</h3>
      <ResponsiveContainer width="100%" height={180}>
        {isComplex ? (
          <RechartsBarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => format === 'currency' ? `₹${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v: number) => [`₹${v.toLocaleString()}`]} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="gross" name="Gross" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
            <Bar dataKey="net" name="Net" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
            <Bar dataKey="deductions" name="Deductions" fill={COLORS[3]} radius={[3, 3, 0, 0]} />
          </RechartsBarChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => format === 'currency' ? `₹${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v: number) => [format === 'currency' ? `₹${v.toLocaleString()}` : v]} />
            <Line type="monotone" dataKey="value" stroke={COLORS[4]} strokeWidth={2} dot={{ r: 3, fill: COLORS[4] }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

const AnalyticsDashboard = () => {
  const currentYear = new Date().getFullYear()

  const { data: demographics, isLoading: demoLoading } = useQuery({
    queryKey: ['workforce-demographics'],
    queryFn: () => reportsService.getWorkforceDemographics(),
  })

  const { data: headcount } = useQuery({
    queryKey: ['headcount-trend'],
    queryFn: () => reportsService.getHeadcountTrend(12),
  })

  const { data: leaveStats } = useQuery({
    queryKey: ['leave-analytics', currentYear],
    queryFn: () => reportsService.getLeaveAnalytics(currentYear),
  })

  const { data: expenseStats } = useQuery({
    queryKey: ['expense-analytics', currentYear],
    queryFn: () => reportsService.getExpenseAnalytics(currentYear),
  })

  const { data: payrollStats } = useQuery({
    queryKey: ['payroll-analytics', currentYear],
    queryFn: () => reportsService.getPayrollAnalytics(currentYear),
  })

  const { data: taskStats } = useQuery({
    queryKey: ['task-analytics'],
    queryFn: () => reportsService.getTaskAnalytics(),
  })

  if (demoLoading) {
    return <div className="animate-pulse h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
  }

  return (
    <div className="space-y-6">
      {/* Workforce Overview */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Workforce Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Active" value={demographics?.total_active ?? 0} />
          <StatCard label="Departments" value={Object.keys(demographics?.by_department ?? {}).length} />
          <StatCard label="Roles" value={Object.keys(demographics?.by_role ?? {}).length} />
          <StatCard label="Designations" value={Object.keys(demographics?.by_designation ?? {}).length} />
        </div>
        <div className="grid md:grid-cols-3 gap-6 mt-4">
          <HBarChart data={demographics?.by_department ?? {}} label="By Department" />
          <HBarChart data={demographics?.by_role ?? {}} label="By Role" />
          <HBarChart data={demographics?.by_designation ?? {}} label="Top Designations" />
        </div>
      </section>

      {/* Headcount Trend */}
      {headcount && headcount.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Headcount Trend</h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 overflow-x-auto">
            <div className="flex items-end gap-1 h-40 min-w-[600px]">
              {headcount.map((point) => {
                const max = Math.max(...headcount.map(p => p.headcount), 1)
                return (
                  <div key={point.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{point.headcount}</span>
                    <div
                      className="w-full bg-blue-400 rounded-t transition-all duration-300"
                      style={{ height: `${(point.headcount / max) * 120}px` }}
                    />
                    {point.new_joiners > 0 && (
                      <span className="text-[9px] text-green-600 font-medium">+{point.new_joiners}</span>
                    )}
                    <span className="text-[9px] text-gray-400 dark:text-gray-500">{point.month.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Task & Leave Analytics */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tasks */}
        {taskStats && (
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Task Analytics</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Total" value={taskStats.total} />
              <StatCard label="Completed" value={taskStats.completed} sub={`${taskStats.completion_rate}%`} />
              <StatCard label="Overdue" value={taskStats.overdue} />
              <StatCard label="Completion Rate" value={`${taskStats.completion_rate}%`} />
            </div>
            <HBarChart data={taskStats.by_status} label="By Status" />
            <div className="mt-4">
              <HBarChart data={taskStats.by_priority} label="By Priority" />
            </div>
          </section>
        )}

        {/* Leave */}
        {leaveStats && (
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Leave Analytics ({currentYear})</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Total Requests" value={leaveStats.total_requests} />
              <StatCard label="Approved" value={leaveStats.approved} sub={`${leaveStats.approval_rate}%`} />
              <StatCard label="Rejected" value={leaveStats.rejected} />
              <StatCard label="Pending" value={leaveStats.pending} />
            </div>
            <HBarChart data={leaveStats.by_type} label="By Leave Type" />
            {leaveStats.monthly_trend && Object.keys(leaveStats.monthly_trend).length > 0 && (
              <div className="mt-4">
                <MonthlyTrendChart data={leaveStats.monthly_trend} label="Monthly Leave Requests" format="count" />
              </div>
            )}
          </section>
        )}
      </div>

      {/* Expense & Payroll Analytics */}
      <div className="grid md:grid-cols-2 gap-6">
        {expenseStats && (
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Expense Analytics ({currentYear})</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Total Submitted" value={`₹${expenseStats.total_submitted.toLocaleString()}`} />
              <StatCard label="Total Approved" value={`₹${expenseStats.total_approved.toLocaleString()}`} />
              <StatCard label="Claims" value={expenseStats.count} />
            </div>
            <HBarChart data={expenseStats.by_category} label="By Category" />
            {expenseStats.monthly_trend && Object.keys(expenseStats.monthly_trend).length > 0 && (
              <div className="mt-4">
                <MonthlyTrendChart data={expenseStats.monthly_trend} label="Monthly Expense Trend" format="currency" />
              </div>
            )}
          </section>
        )}

        {payrollStats && (
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Payroll Analytics ({currentYear})</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Total Gross" value={`₹${payrollStats.total_gross.toLocaleString()}`} />
              <StatCard label="Total Net" value={`₹${payrollStats.total_net.toLocaleString()}`} />
              <StatCard label="Total Deductions" value={`₹${payrollStats.total_deductions.toLocaleString()}`} />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Statutory Breakdown</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
                <span className="text-gray-600 dark:text-gray-300">EPF</span>
                <span className="font-medium">₹{payrollStats.deduction_breakdown.epf.toLocaleString()}</span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
                <span className="text-gray-600 dark:text-gray-300">ESI</span>
                <span className="font-medium">₹{payrollStats.deduction_breakdown.esi.toLocaleString()}</span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
                <span className="text-gray-600 dark:text-gray-300">TDS</span>
                <span className="font-medium">₹{payrollStats.deduction_breakdown.tds.toLocaleString()}</span>
              </div>
              <div className="flex justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded">
                <span className="text-gray-600 dark:text-gray-300">Prof. Tax</span>
                <span className="font-medium">₹{payrollStats.deduction_breakdown.professional_tax.toLocaleString()}</span>
              </div>
            </div>
            {payrollStats.monthly_trend && Object.keys(payrollStats.monthly_trend).length > 0 && (
              <div className="mt-4">
                <MonthlyTrendChart data={payrollStats.monthly_trend} label="Monthly Payroll Trend" format="currency" />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default AnalyticsDashboard
