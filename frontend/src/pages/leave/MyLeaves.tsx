import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Calendar, X } from 'lucide-react'

import { leaveService } from '@/services/leave.service'
import type { Leave, LeaveBalance, LeaveType } from '@/types/leave.types'
import { formatDate, timeAgo } from '@/utils/formatDate'
import { LEAVE_STATUS_COLORS } from '@/constants/status'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import Modal from '@/components/common/Modal'
import ApplyLeaveModal from './ApplyLeaveModal'

// ── Leave type meta ───────────────────────────────────────────────────────────
const LEAVE_META: Record<LeaveType, { label: string; color: string; barColor: string }> = {
  casual:    { label: 'Casual Leave',    color: 'text-blue-600',   barColor: 'bg-blue-500' },
  sick:      { label: 'Sick Leave',      color: 'text-green-600',  barColor: 'bg-green-500' },
  earned:    { label: 'Earned Leave',    color: 'text-purple-600', barColor: 'bg-purple-500' },
  comp_off:  { label: 'Comp-off',        color: 'text-amber-600',  barColor: 'bg-amber-400' },
  unpaid:    { label: 'Unpaid Leave',    color: 'text-gray-600',   barColor: 'bg-gray-400' },
  maternity: { label: 'Maternity Leave', color: 'text-pink-600',   barColor: 'bg-pink-400' },
  paternity: { label: 'Paternity Leave', color: 'text-cyan-600',   barColor: 'bg-cyan-400' },
}

// ── Balance card ──────────────────────────────────────────────────────────────
const BalanceCard = ({ balance }: { balance: LeaveBalance }) => {
  const meta = LEAVE_META[balance.leave_type] ?? {
    label: balance.leave_type, color: 'text-gray-600', barColor: 'bg-gray-400',
  }
  const usedPct = balance.total > 0 ? (balance.used / balance.total) * 100 : 0

  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        {meta.label}
      </p>
      <div className="flex items-end justify-between mb-3">
        <span className={`text-3xl font-bold ${meta.color}`}>{balance.remaining}</span>
        <span className="text-xs text-gray-400">{balance.used}/{balance.total} used</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${meta.barColor}`}
          style={{ width: `${Math.min(usedPct, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{balance.remaining} days remaining</p>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
const BalanceSkeleton = () => (
  <div className="card p-5 space-y-3 animate-pulse">
    <div className="h-3 bg-gray-200 rounded w-24" />
    <div className="h-8 bg-gray-200 rounded w-12" />
    <div className="h-1.5 bg-gray-200 rounded w-full" />
  </div>
)

// ── Cancel confirm modal ──────────────────────────────────────────────────────
const CancelModal = ({
  leave,
  onClose,
}: {
  leave: Leave | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const { mutate, isPending } = useMutation({
    mutationFn: () => leaveService.cancel(leave!.id),
    onSuccess: () => {
      toast.success('Leave request cancelled')
      queryClient.invalidateQueries({ queryKey: ['leaves', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['leaves', 'balances'] })
      onClose()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Cancellation failed'),
  })

  if (!leave) return null

  return (
    <Modal open={!!leave} onClose={onClose} title="Cancel Leave Request" size="sm">
      <p className="text-sm text-gray-600 mb-6">
        Are you sure you want to cancel your{' '}
        <span className="font-medium text-gray-900 capitalize">
          {leave.leave_type.replace(/_/g, ' ')}
        </span>{' '}
        leave from{' '}
        <span className="font-medium text-gray-900">
          {formatDate(leave.start_date, 'MMM d')}
        </span>{' '}
        to{' '}
        <span className="font-medium text-gray-900">
          {formatDate(leave.end_date, 'MMM d, yyyy')}
        </span>?
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
          Keep it
        </Button>
        <Button variant="danger" className="flex-1" loading={isPending} onClick={() => mutate()}>
          Yes, Cancel
        </Button>
      </div>
    </Modal>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MyLeaves = () => {
  const [applyOpen, setApplyOpen]     = useState(false)
  const [cancelLeave, setCancelLeave] = useState<Leave | null>(null)

  const { data: balances = [], isLoading: balLoading } = useQuery({
    queryKey: ['leaves', 'balances'],
    queryFn: leaveService.getMyBalances,
  })

  const { data: leaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', 'my'],
    queryFn: () => leaveService.getMyLeaves(),
  })

  return (
    <div className="space-y-6">
      {/* ── Balance cards + Apply button ─────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 flex-1">
          {balLoading
            ? Array.from({ length: 5 }).map((_, i) => <BalanceSkeleton key={i} />)
            : balances.map((b) => <BalanceCard key={b.leave_type} balance={b} />)}
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus size={15} />}
          onClick={() => setApplyOpen(true)}
          className="shrink-0"
        >
          Apply Leave
        </Button>
      </div>

      {/* ── Leave history ────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Leave History</h3>
            <p className="text-xs text-gray-500 mt-0.5">All your leave requests</p>
          </div>
        </div>

        {leavesLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <EmptyState
            icon={<Calendar size={40} className="text-gray-300" />}
            title="No leave requests"
            description="You haven't applied for any leave yet."
            action={
              <Button variant="primary" size="sm" onClick={() => setApplyOpen(true)}>
                Apply Now
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Type', 'From', 'To', 'Days', 'Reason', 'Applied On', 'Status', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-gray-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaves.map((leave) => {
                  const meta = LEAVE_META[leave.leave_type]
                  return (
                    <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${meta?.color ?? 'text-gray-700'} capitalize`}>
                          {leave.leave_type.replace(/_/g, ' ')}
                        </span>
                        {leave.is_half_day && (
                          <span className="ml-1.5 text-xs text-gray-400 uppercase">
                            ({leave.half_day_period})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDate(leave.start_date, 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDate(leave.end_date, 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {leave.total_days}d
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                        <span className="truncate block">{leave.reason}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {timeAgo(leave.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={leave.status}
                          className={LEAVE_STATUS_COLORS[leave.status] ?? 'bg-gray-100 text-gray-600'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {leave.status === 'pending' && (
                          <button
                            onClick={() => setCancelLeave(leave)}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            <X size={13} /> Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ApplyLeaveModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        balances={balances}
      />
      <CancelModal leave={cancelLeave} onClose={() => setCancelLeave(null)} />
    </div>
  )
}

export default MyLeaves
