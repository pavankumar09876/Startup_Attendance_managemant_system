import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Download, Play, CheckCircle, Eye, FileText,
  Users, DollarSign, Clock, Minus, AlertCircle, CalendarCheck,
} from 'lucide-react'

import { payrollService } from '@/services/payroll.service'
import type { PayrollEntry } from '@/types/payroll.types'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/constants/roles'
import Avatar from '@/components/common/Avatar'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import RunPayrollModal from './RunPayrollModal'
import PayslipDetailModal from './PayslipDetailModal'
import MyPayslipsPage from './MyPayslipsPage'
import ExpensesPage from './ExpensesPage'
import { cn } from '@/utils/cn'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const StatCard = ({
  icon, label, value, sub, color = 'blue',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: 'blue' | 'green' | 'amber' | 'red'
}) => {
  const bg = { blue: 'bg-blue-50 dark:bg-blue-900/20', green: 'bg-green-50 dark:bg-green-900/20', amber: 'bg-amber-50 dark:bg-amber-900/20', red: 'bg-red-50 dark:bg-red-900/20' }[color]
  const ic = { blue: 'text-blue-600', green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-600' }[color]
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className={cn('p-2.5 rounded-xl', bg)}>
          <span className={ic}>{icon}</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

type PageTab = 'payroll' | 'expenses'

const PayrollPage = () => {
  const { isAdmin, hasRole } = useAuth()
  const canManage = isAdmin || hasRole(ROLES.HR)
  const isEmployee = !canManage
  const queryClient = useQueryClient()

  const now = new Date()
  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [year, setYear]       = useState(now.getFullYear())
  const [pageTab, setPageTab] = useState<PageTab>('payroll')
  const [runOpen, setRunOpen]   = useState(false)
  const [selectedPayslip, setSelectedPayslip] = useState<string | null>(null)

  const currentYear = now.getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['payroll', 'summary', month, year],
    queryFn: () => payrollService.getSummary(month, year),
    enabled: canManage,
    staleTime: 1000 * 30,
  })

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['payroll', 'entries', month, year],
    queryFn: () => payrollService.getEntries(month, year),
    enabled: canManage,
    staleTime: 1000 * 30,
  })

  const { mutate: markPaid, isPending: marking } = useMutation({
    mutationFn: (id: string) => payrollService.markAsPaid(id),
    onSuccess: () => {
      toast.success('Marked as paid')
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: markAllPaid, isPending: markingAll } = useMutation({
    mutationFn: () => payrollService.markAllAsPaid(month, year),
    onSuccess: () => {
      toast.success('All marked as paid')
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: allocateLeaves, isPending: allocating } = useMutation({
    mutationFn: () => payrollService.allocateLeaveBalances(year),
    onSuccess: (res) => toast.success(
      res.allocated > 0
        ? `Allocated leave balances for ${res.allocated} records (${res.year})`
        : `All leave balances already allocated for ${res.year}`
    ),
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Allocation failed'),
  })

  const handleExport = async () => {
    try {
      const blob = await payrollService.exportCSV(month, year)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `payroll-${MONTHS[month - 1]}-${year}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
  }

  // ── Employee view ─────────────────────────────────────────────────────────
  if (isEmployee) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setPageTab('payroll')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              pageTab === 'payroll' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            My Payslips
          </button>
          <button
            onClick={() => setPageTab('expenses')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              pageTab === 'expenses' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            )}
          >
            Expenses
          </button>
        </div>
        {pageTab === 'payroll' ? <MyPayslipsPage /> : <ExpensesPage />}
      </div>
    )
  }

  // ── Admin / HR view ───────────────────────────────────────────────────────
  const isProcessed = summary?.is_processed ?? false

  return (
    <>
      <div className="space-y-5">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setPageTab('payroll')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                pageTab === 'payroll' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              Payroll
            </button>
            <button
              onClick={() => setPageTab('expenses')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                pageTab === 'expenses' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              Expenses
            </button>
          </div>

          {pageTab === 'payroll' && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button variant="secondary" leftIcon={<Download size={14} />} onClick={handleExport}>
                Export CSV
              </Button>
              <Button
                variant="secondary"
                leftIcon={<CalendarCheck size={14} />}
                onClick={() => allocateLeaves()}
                disabled={allocating}
              >
                {allocating ? 'Allocating…' : 'Allocate Leaves'}
              </Button>
              {!isProcessed && (
                <Button leftIcon={<Play size={14} />} onClick={() => setRunOpen(true)}>
                  Run Payroll
                </Button>
              )}
            </div>
          )}
        </div>

        {pageTab === 'expenses' ? (
          <ExpensesPage />
        ) : (
          <>
            {/* ── Status banner ─────────────────────────────────── */}
            {!loadingSummary && (
              <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border',
                isProcessed
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
              )}>
                {isProcessed
                  ? <CheckCircle size={16} className="text-green-600 shrink-0" />
                  : <AlertCircle size={16} className="text-amber-600 shrink-0" />}
                <p className="text-sm font-medium">
                  {isProcessed
                    ? `Payroll processed — ${summary?.processed_count ?? 0} employees`
                    : `Payroll not yet processed for ${MONTHS[month - 1]} ${year}`}
                </p>
                {isProcessed && summary && (
                  <div className="ml-auto flex items-center gap-4 text-xs text-green-700 dark:text-green-400">
                    <span>{summary.paid_count} paid</span>
                    <span>{summary.pending_count} pending</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Stat cards ────────────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                icon={<DollarSign size={18} />}
                label="Total Payroll"
                value={fmtINR(summary?.total_amount ?? 0)}
                sub={`${MONTHS[month - 1]} ${year}`}
                color="blue"
              />
              <StatCard
                icon={<Users size={18} />}
                label="Processed"
                value={String(summary?.processed_count ?? 0)}
                sub="employees"
                color="green"
              />
              <StatCard
                icon={<Clock size={18} />}
                label="Pending Payment"
                value={String(summary?.pending_count ?? 0)}
                sub="not yet paid"
                color="amber"
              />
              <StatCard
                icon={<Minus size={18} />}
                label="Total Deductions"
                value={fmtINR(summary?.total_deductions ?? 0)}
                sub="PF + TDS + ESI"
                color="red"
              />
            </div>

            {/* ── Bulk actions ──────────────────────────────────── */}
            {isProcessed && entries.some((e) => e.status !== 'paid') && (
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  leftIcon={<CheckCircle size={14} />}
                  loading={markingAll}
                  onClick={() => markAllPaid()}
                >
                  Mark All as Paid
                </Button>
              </div>
            )}

            {/* ── Table ─────────────────────────────────────────── */}
            <div className="card overflow-hidden">
              {loadingEntries ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="py-8">
                  <EmptyState
                    icon={<FileText size={36} className="text-gray-300" />}
                    title="No payroll entries"
                    description={isProcessed
                      ? 'No entries found for this period.'
                      : 'Run payroll to generate entries for this period.'}
                    action={!isProcessed ? (
                      <Button leftIcon={<Play size={14} />} onClick={() => setRunOpen(true)}>
                        Run Payroll
                      </Button>
                    ) : undefined}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        {['Employee', 'Basic', 'Allowances', 'Deductions', 'Net Salary', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={entry.employee_name} size="sm" />
                              <div>
                                <p className="font-medium text-gray-800 dark:text-gray-100">{entry.employee_name}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{entry.employee_code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{fmtINR(entry.basic)}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                            {fmtINR(entry.hra + entry.travel_allowance + entry.bonus + entry.overtime)}
                          </td>
                          <td className="px-4 py-3 text-red-600">{fmtINR(entry.total_deductions)}</td>
                          <td className="px-4 py-3 font-semibold text-green-700">{fmtINR(entry.net_salary)}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full',
                              entry.status === 'paid'      ? 'bg-green-100 text-green-700' :
                              entry.status === 'processed' ? 'bg-blue-100 text-blue-700'  :
                                                             'bg-amber-100 text-amber-700',
                            )}>
                              {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedPayslip(entry.id)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800
                                  px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              >
                                <Eye size={11} />
                                View
                              </button>
                              {entry.status !== 'paid' && (
                                <button
                                  onClick={() => markPaid(entry.id)}
                                  disabled={marking}
                                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800
                                    px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle size={11} />
                                  Mark Paid
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {runOpen && (
        <RunPayrollModal
          open={runOpen}
          onClose={() => setRunOpen(false)}
          defaultMonth={month}
          defaultYear={year}
        />
      )}

      {selectedPayslip && (
        <PayslipDetailModal
          payslipId={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
        />
      )}
    </>
  )
}

export default PayrollPage
