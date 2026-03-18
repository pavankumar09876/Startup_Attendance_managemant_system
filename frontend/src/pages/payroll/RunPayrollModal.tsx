import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, Play, Eye } from 'lucide-react'

import { payrollService } from '@/services/payroll.service'
import type { PayrollEntry } from '@/types/payroll.types'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

interface Props {
  open: boolean
  onClose: () => void
  defaultMonth: number
  defaultYear: number
}

const RunPayrollModal = ({ open, onClose, defaultMonth, defaultYear }: Props) => {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear]   = useState(defaultYear)
  const [previewed, setPreviewed] = useState(false)

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const {
    data: preview,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['payroll-preview', month, year],
    queryFn: () => payrollService.previewPayroll(month, year),
    enabled: false,
  })

  const { mutate: run, isPending: running } = useMutation({
    mutationFn: () => payrollService.runPayroll(month, year),
    onSuccess: (data) => {
      toast.success(`Payroll processed for ${data.count} employees`)
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to run payroll'),
  })

  const handlePreview = async () => {
    await refetch()
    setPreviewed(true)
  }

  const warnings = preview?.filter((e) => e.has_attendance_warning) ?? []
  const totalGross = preview?.reduce((s, e) => s + e.gross, 0) ?? 0
  const totalNet   = preview?.reduce((s, e) => s + e.net_salary, 0) ?? 0

  return (
    <Modal open={open} onClose={onClose} title="Run Payroll" size="xl">
      <div className="space-y-5">
        {/* Month / Year */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => { setMonth(Number(e.target.value)); setPreviewed(false) }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setPreviewed(false) }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="secondary"
              leftIcon={<Eye size={14} />}
              onClick={handlePreview}
              loading={isFetching}
            >
              Preview Payroll
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {previewed && warnings.length > 0 && (
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Missing attendance data</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {warnings.length} employee{warnings.length > 1 ? 's' : ''} have incomplete attendance records.
                LOP will be calculated based on available data.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                {warnings.map((w) => w.employee_name).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Preview table */}
        {previewed && preview && preview.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Preview — {preview.length} employees
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total Gross: <span className="font-semibold text-gray-800 dark:text-gray-100">{fmtINR(totalGross)}</span>
                {' | '}
                Total Net: <span className="font-semibold text-green-700">{fmtINR(totalNet)}</span>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    {['Employee', 'Basic', 'HRA', 'Allowances', 'Deductions', 'Net'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {preview.map((entry) => (
                    <tr key={entry.id} className={cn(entry.has_attendance_warning && 'bg-amber-50 dark:bg-amber-900/20')}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {entry.has_attendance_warning && (
                            <AlertTriangle size={11} className="text-amber-500" />
                          )}
                          <span className="font-medium text-gray-800 dark:text-gray-100">{entry.employee_name}</span>
                        </div>
                        <p className="text-gray-400 dark:text-gray-500">{entry.employee_code}</p>
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{fmtINR(entry.basic)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{fmtINR(entry.hra)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{fmtINR(entry.travel_allowance + entry.bonus)}</td>
                      <td className="px-3 py-2 text-red-600">{fmtINR(entry.total_deductions)}</td>
                      <td className="px-3 py-2 font-semibold text-green-700">{fmtINR(entry.net_salary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {previewed && preview?.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No employees found for this period.</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            leftIcon={<Play size={14} />}
            disabled={!previewed || !preview?.length}
            loading={running}
            onClick={() => run()}
          >
            Confirm &amp; Process Payroll
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default RunPayrollModal
