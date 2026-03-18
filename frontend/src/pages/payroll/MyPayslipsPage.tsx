import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

import { payrollService } from '@/services/payroll.service'
import type { Payslip } from '@/types/user.types'
import EmptyState from '@/components/common/EmptyState'
import PayslipDetailModal from './PayslipDetailModal'
import { cn } from '@/utils/cn'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const StatusBadge = ({ status }: { status: Payslip['status'] }) => (
  <span className={cn(
    'text-xs font-medium px-2 py-0.5 rounded-full',
    status === 'paid'      ? 'bg-green-100 text-green-700' :
    status === 'processed' ? 'bg-blue-100 text-blue-700'  :
                             'bg-amber-100 text-amber-700',
  )}>
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
)

const MyPayslipsPage = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: payrollService.getMyPayslips,
    staleTime: 1000 * 60 * 5,
  })

  const handleDownload = async (ps: Payslip) => {
    setDownloadingId(ps.id)
    try {
      const blob = await payrollService.downloadPayslip(ps.id)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `payslip-${MONTHS[ps.month - 1]}-${ps.year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (payslips.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={40} className="text-gray-300" />}
        title="No payslips yet"
        description="Your payslips will appear here once payroll is processed."
      />
    )
  }

  return (
    <>
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">My Payslips</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{payslips.length} payslips</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Month', 'Year', 'Net Salary', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {payslips.map((ps) => (
                <tr key={ps.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{MONTHS[ps.month - 1]}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{ps.year}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{fmtINR(ps.net_salary)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={ps.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedId(ps.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(ps)}
                        disabled={downloadingId === ps.id}
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                          px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        <Download size={12} />
                        {downloadingId === ps.id ? 'Downloading…' : 'PDF'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId && (
        <PayslipDetailModal
          payslipId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  )
}

export default MyPayslipsPage
