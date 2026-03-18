import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, ExternalLink, Check, X, Receipt } from 'lucide-react'

import { payrollService } from '@/services/payroll.service'
import type { Expense } from '@/types/payroll.types'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/constants/roles'
import Avatar from '@/components/common/Avatar'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import SubmitExpenseModal from './SubmitExpenseModal'
import { cn } from '@/utils/cn'

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const CATEGORY_COLORS: Record<string, string> = {
  travel:    'bg-blue-100 text-blue-700',
  meals:     'bg-green-100 text-green-700',
  equipment: 'bg-purple-100 text-purple-700',
  other:     'bg-gray-100 text-gray-600',
}

const StatusBadge = ({ status }: { status: Expense['status'] }) => (
  <span className={cn(
    'text-xs font-medium px-2 py-0.5 rounded-full',
    status === 'approved' ? 'bg-green-100 text-green-700' :
    status === 'rejected' ? 'bg-red-100 text-red-700'    :
                            'bg-amber-100 text-amber-700',
  )}>
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
)

type Tab = 'mine' | 'queue'

const ExpensesPage = () => {
  const { hasRole, isAdmin, user } = useAuth()
  const canApprove = isAdmin || hasRole(ROLES.MANAGER) || hasRole(ROLES.HR)
  const queryClient = useQueryClient()

  const [tab, setTab]             = useState<Tab>('mine')
  const [submitOpen, setSubmitOpen] = useState(false)
  const [rejectId, setRejectId]   = useState<string | null>(null)

  const { data: myExpenses = [], isLoading: loadingMine } = useQuery({
    queryKey: ['my-expenses'],
    queryFn: payrollService.getMyExpenses,
    staleTime: 1000 * 30,
  })

  const { data: pending = [], isLoading: loadingQueue } = useQuery({
    queryKey: ['pending-expenses'],
    queryFn: payrollService.getPendingExpenses,
    enabled: canApprove,
    staleTime: 1000 * 30,
  })

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => payrollService.approveExpense(id),
    onSuccess: () => {
      toast.success('Expense approved')
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['my-expenses'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: reject } = useMutation({
    mutationFn: (id: string) => payrollService.rejectExpense(id),
    onSuccess: () => {
      toast.success('Expense rejected')
      setRejectId(null)
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['my-expenses'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: cancel } = useMutation({
    mutationFn: (id: string) => payrollService.cancelExpense(id),
    onSuccess: () => {
      toast.success('Expense cancelled')
      queryClient.invalidateQueries({ queryKey: ['my-expenses'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const isLoading = tab === 'mine' ? loadingMine : loadingQueue
  const rows      = tab === 'mine' ? myExpenses  : pending

  return (
    <>
      <div className="space-y-5">
        {/* Tabs + actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setTab('mine')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                tab === 'mine' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              My Expenses
              {myExpenses.filter((e) => e.status === 'pending').length > 0 && (
                <span className="ml-1 text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
                  {myExpenses.filter((e) => e.status === 'pending').length}
                </span>
              )}
            </button>
            {canApprove && (
              <button
                onClick={() => setTab('queue')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  tab === 'queue' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                Approval Queue
                {pending.length > 0 && (
                  <span className="ml-1 text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5">
                    {pending.length}
                  </span>
                )}
              </button>
            )}
          </div>
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setSubmitOpen(true)}>
            Submit Expense
          </Button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8">
              <EmptyState
                icon={<Receipt size={36} className="text-gray-300" />}
                title={tab === 'mine' ? 'No expenses submitted' : 'No pending approvals'}
                description={tab === 'mine'
                  ? 'Submit your first expense reimbursement.'
                  : 'All expenses have been reviewed.'}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {(tab === 'queue'
                      ? ['Employee', 'Title', 'Category', 'Amount', 'Project', 'Submitted', 'Receipt', 'Actions']
                      : ['Title', 'Category', 'Amount', 'Project', 'Date', 'Status', 'Receipt', 'Actions']
                    ).map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                      {tab === 'queue' && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={exp.user_name} src={exp.user_avatar} size="xs" />
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{exp.user_name}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{exp.title}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                          CATEGORY_COLORS[exp.category] ?? 'bg-gray-100 text-gray-600',
                        )}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{fmtINR(exp.amount)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {exp.project_name
                          ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{exp.project_name}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(tab === 'queue' ? exp.created_at : exp.date)}
                      </td>
                      {tab === 'mine' && (
                        <td className="px-4 py-3">
                          <StatusBadge status={exp.status} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {exp.receipt_url ? (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink size={11} />
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tab === 'mine' ? (
                          exp.status === 'pending' && (
                            <button
                              onClick={() => cancel(exp.id)}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            >
                              Cancel
                            </button>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {rejectId === exp.id ? (
                              <>
                                <span className="text-xs text-red-600">Reject?</span>
                                <button
                                  onClick={() => reject(exp.id)}
                                  className="text-xs font-medium text-red-600 hover:text-red-800"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setRejectId(null)}
                                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => approve(exp.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700
                                    rounded-lg hover:bg-green-200 transition-colors"
                                >
                                  <Check size={11} />
                                  Approve
                                </button>
                                <button
                                  onClick={() => setRejectId(exp.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600
                                    rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                >
                                  <X size={11} />
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <SubmitExpenseModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </>
  )
}

export default ExpensesPage
