import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Download, FileText } from 'lucide-react'

import { reportsService } from '@/services/reports.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2']

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const fmtINRCompact = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n)

// ── Pie custom label ──────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return percent > 0.06 ? (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null
}

const PayrollReport = () => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

  const currentYear = now.getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear]

  const { data, isLoading } = useQuery({
    queryKey: ['report-payroll', year],
    queryFn: () => reportsService.getPayrollReport({ year }),
    staleTime: 1000 * 60 * 5,
  })

  const handleExport = async (type: 'csv' | 'pdf') => {
    try {
      const blob = type === 'csv'
        ? await reportsService.exportCSV('payroll', { year })
        : await reportsService.exportPDF('payroll', { year })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `payroll-report-${year}.${type}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  // Salary growth lines: all keys except 'month'
  const growthLines = data?.salary_growth?.length
    ? Object.keys(data.salary_growth[0]).filter((k) => k !== 'month')
    : []

  return (
    <div className="space-y-6">
      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2 mt-4">
            <Button variant="secondary" leftIcon={<Download size={14} />} onClick={() => handleExport('csv')}>
              Export CSV
            </Button>
            <Button variant="secondary" leftIcon={<FileText size={14} />} onClick={() => handleExport('pdf')}>
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-72 animate-pulse bg-gray-50 dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Charts ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Monthly payroll cost bar chart */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Monthly Payroll Cost — {year}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.monthly ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtINRCompact} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: number) => [fmtINR(v)]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total_basic"      name="Basic + Allowances" fill={COLORS[0]} stackId="a" />
                  <Bar dataKey="total_deductions" name="Deductions"          fill={COLORS[3]} stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Dept cost breakdown pie */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Department Cost Breakdown</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{year} total payroll</p>
              {(data?.by_department?.length ?? 0) === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={data?.by_department ?? []}
                      dataKey="amount"
                      nameKey="department"
                      cx="50%"
                      cy="50%"
                      outerRadius={78}
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {(data?.by_department ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(v: number) => [fmtINR(v)]}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Salary growth trend */}
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">Salary Growth Trend by Role</p>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={data?.salary_growth ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtINRCompact} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v: number) => [fmtINR(v)]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                {growthLines.map((role, i) => (
                  <Line
                    key={role}
                    type="monotone"
                    dataKey={role}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Monthly summary table ───────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Monthly Payroll Summary -- {year}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Month', 'Employees', 'Total Basic', 'Deductions', 'Net Payout', 'Status'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(data?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                        No payroll data for {year}.
                      </td>
                    </tr>
                  ) : (
                    (data?.rows ?? []).map((row) => (
                      <tr key={`${row.month}-${row.year}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{row.month}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{row.employee_count}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{fmtINR(row.total_basic)}</td>
                        <td className="px-4 py-3 text-red-600">{fmtINR(row.total_deductions)}</td>
                        <td className="px-4 py-3 font-semibold text-green-700">{fmtINR(row.net_payout)}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            row.status === 'processed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                          )}>
                            {row.status === 'processed' ? 'Processed' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(data?.rows?.length ?? 0) > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100" colSpan={2}>
                        Total ({data?.rows?.filter((r) => r.status === 'processed').length} months processed)
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">
                        {fmtINR((data?.rows ?? []).reduce((s, r) => s + r.total_basic, 0))}
                      </td>
                      <td className="px-4 py-3 font-semibold text-red-600">
                        {fmtINR((data?.rows ?? []).reduce((s, r) => s + r.total_deductions, 0))}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-700">
                        {fmtINR((data?.rows ?? []).reduce((s, r) => s + r.net_payout, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PayrollReport
