import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Building2, X } from 'lucide-react'
import toast from 'react-hot-toast'

import { payrollService } from '@/services/payroll.service'
import type { PayrollEntry } from '@/types/payroll.types'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const maskAccount = (acc?: string) => {
  if (!acc) return '—'
  return acc.length > 4 ? `${'*'.repeat(acc.length - 4)}${acc.slice(-4)}` : acc
}

interface Props {
  payslipId: string
  onClose: () => void
}

const PayslipDetailModal = ({ payslipId, onClose }: Props) => {
  const [downloading, setDownloading] = useState(false)

  const { data: ps, isLoading } = useQuery({
    queryKey: ['payslip', payslipId],
    queryFn: () => payrollService.getPayslip(payslipId),
  })

  const handleDownload = async () => {
    if (!ps) return
    setDownloading(true)
    try {
      const blob = await payrollService.downloadPayslip(payslipId)
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `payslip-${ps.employee_code}-${MONTHS[(ps as any).month - 1]}-${(ps as any).year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl z-10 max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X size={18} />
        </button>

        {isLoading || !ps ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading payslip…</div>
        ) : (
          <div className="p-8">
            {/* Company header */}
            <div className="flex items-center gap-3 pb-5 border-b border-gray-200 mb-5">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
                <Building2 size={22} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Workforce Pro</p>
                <p className="text-xs text-gray-500">
                  Payslip for {MONTHS[((ps as any).month ?? 1) - 1]} {(ps as any).year}
                </p>
              </div>
              <div className="ml-auto">
                <span className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded-full',
                  ps.status === 'paid'      ? 'bg-green-100 text-green-700' :
                  ps.status === 'processed' ? 'bg-blue-100 text-blue-700'  :
                                              'bg-amber-100 text-amber-700',
                )}>
                  {ps.status.charAt(0).toUpperCase() + ps.status.slice(1)}
                </span>
              </div>
            </div>

            {/* Employee info */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
              <div>
                <p className="text-xs text-gray-400">Employee Name</p>
                <p className="font-semibold text-gray-900">{ps.employee_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Employee ID</p>
                <p className="font-semibold text-gray-900">{ps.employee_code}</p>
              </div>
              {ps.department_name && (
                <div>
                  <p className="text-xs text-gray-400">Department</p>
                  <p className="font-semibold text-gray-900">{ps.department_name}</p>
                </div>
              )}
              {ps.designation && (
                <div>
                  <p className="text-xs text-gray-400">Designation</p>
                  <p className="font-semibold text-gray-900">{ps.designation}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400">Bank Account</p>
                <p className="font-semibold text-gray-900">{maskAccount(ps.bank_account)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Working Days</p>
                <p className="font-semibold text-gray-900">{ps.paid_days}/{ps.working_days}</p>
              </div>
            </div>

            {/* Attendance summary */}
            <div className="flex gap-6 mb-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
              <div>Working Days: <span className="font-semibold text-gray-900">{ps.paid_days}/{ps.working_days}</span></div>
              <div>Leaves: <span className="font-semibold text-gray-900">{ps.leave_days}</span></div>
              <div>LOP Days: <span className={cn('font-semibold', ps.lop_days > 0 ? 'text-red-600' : 'text-gray-900')}>{ps.lop_days}</span></div>
            </div>

            {/* Earnings / Deductions */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Earnings */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Earnings</p>
                <div className="space-y-2">
                  {[
                    { label: 'Basic Salary',      value: ps.basic },
                    { label: 'HRA',               value: ps.hra },
                    { label: 'Travel Allowance',  value: ps.travel_allowance },
                    { label: 'Bonus',             value: ps.bonus },
                    { label: 'Overtime',          value: ps.overtime },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{label}</span>
                      <span className={cn('font-medium', value === 0 ? 'text-gray-400' : 'text-gray-800')}>
                        {fmtINR(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-800">Total Earnings</span>
                  <span className="text-sm font-bold text-gray-900">{fmtINR(ps.gross)}</span>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deductions</p>
                <div className="space-y-2">
                  {[
                    { label: 'PF (12%)',          value: ps.pf },
                    { label: 'TDS',               value: ps.tds },
                    { label: 'ESI',               value: ps.esi },
                    { label: 'Loss of Pay',       value: ps.lop },
                    { label: 'Other Deductions',  value: ps.other_deductions },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{label}</span>
                      <span className={cn('font-medium', value === 0 ? 'text-gray-400' : 'text-red-600')}>
                        {fmtINR(value)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-800">Total Deductions</span>
                  <span className="text-sm font-bold text-red-600">{fmtINR(ps.total_deductions)}</span>
                </div>
              </div>
            </div>

            {/* Net salary */}
            <div className="flex items-center justify-between px-6 py-4 bg-green-50 border border-green-200 rounded-xl mb-6">
              <div>
                <p className="text-xs text-green-700 font-medium">Net Salary (Take Home)</p>
                <p className="text-2xl font-bold text-green-800">{fmtINR(ps.net_salary)}</p>
              </div>
              {ps.paid_on && (
                <div className="text-right">
                  <p className="text-xs text-green-600">Paid on</p>
                  <p className="text-sm font-semibold text-green-800">
                    {new Date(ps.paid_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>

            {/* Download */}
            <Button
              className="w-full"
              leftIcon={<Download size={15} />}
              loading={downloading}
              onClick={handleDownload}
            >
              Download PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PayslipDetailModal
