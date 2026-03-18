import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, X, Users, CheckSquare, Square } from 'lucide-react'

import { leaveService } from '@/services/leave.service'
import type { Leave } from '@/types/leave.types'
import { formatDate, timeAgo } from '@/utils/formatDate'
import { LEAVE_STATUS_COLORS } from '@/constants/status'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'

type StatusTab = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'pending',  label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

// ── Reject modal ──────────────────────────────────────────────────────────────
const RejectModal = ({
  leave,
  onClose,
}: {
  leave: Leave | null
  onClose: () => void
}) => {
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: () => leaveService.reject(leave!.id, reason),
    onSuccess: () => {
      toast.success('Leave request rejected')
      queryClient.invalidateQueries({ queryKey: ['leaves', 'approvals'] })
      onClose()
      setReason('')
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Action failed'),
  })

  if (!leave) return null

  return (
    <Modal open={!!leave} onClose={onClose} title="Reject Leave Request" size="sm">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Rejecting{' '}
        <span className="font-medium text-gray-900 dark:text-white">{leave.employee_name}'s</span>{' '}
        <span className="capitalize">{leave.leave_type.replace(/_/g, ' ')}</span> leave.
      </p>
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
          Reason for rejection
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Provide a reason so the employee knows why…"
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm resize-none
            bg-white dark:bg-gray-800 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          loading={isPending}
          disabled={!reason.trim()}
          onClick={() => mutate()}
        >
          Reject
        </Button>
      </div>
    </Modal>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const LeaveApprovals = () => {
  const [activeTab, setActiveTab]       = useState<StatusTab>('pending')
  const [department, setDepartment]     = useState('')
  const [rejectLeave, setRejectLeave]   = useState<Leave | null>(null)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', 'approvals', activeTab, department],
    queryFn: () =>
      leaveService.getAll({
        status:     activeTab !== 'all' ? activeTab : undefined,
        department: department || undefined,
        limit:      50,
      }),
    staleTime: 1000 * 30,
  })

  const leaves: Leave[] = data?.leaves ?? []

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (id: string) => leaveService.approve(id),
    onSuccess: () => {
      toast.success('Leave approved!')
      queryClient.invalidateQueries({ queryKey: ['leaves', 'approvals'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Approval failed'),
  })

  const { mutate: bulkApprove, isPending: bulkApproving } = useMutation({
    mutationFn: () => leaveService.bulkApprove(Array.from(selected)),
    onSuccess: (res) => {
      toast.success(`${res.updated} leave(s) approved!`)
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['leaves', 'approvals'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Bulk approve failed'),
  })

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () => {
    const pendingIds = leaves.filter((l) => l.status === 'pending').map((l) => l.id)
    if (selected.size === pendingIds.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingIds))
    }
  }

  const pendingLeaves    = leaves.filter((l) => l.status === 'pending')
  const allPendingSelect = pendingLeaves.length > 0 && selected.size === pendingLeaves.length

  return (
    <div className="space-y-4">
      {/* ── Filters row ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelected(new Set()) }}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              {tab.label}
              {tab.id === 'pending' && pendingLeaves.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {pendingLeaves.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Department */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            <option value="engineering">Engineering</option>
            <option value="design">Design</option>
            <option value="hr">HR</option>
            <option value="sales">Sales</option>
            <option value="finance">Finance</option>
          </select>

          {/* Bulk approve */}
          {selected.size > 0 && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check size={13} />}
              loading={bulkApproving}
              onClick={() => bulkApprove()}
            >
              Approve {selected.size} selected
            </Button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <EmptyState
            icon={<Users size={40} className="text-gray-300 dark:text-gray-600" />}
            title="No leave requests"
            description={activeTab === 'pending'
              ? "All caught up! No pending approvals."
              : "No requests match the current filter."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {/* Bulk checkbox — only show when on pending tab */}
                  {activeTab !== 'rejected' && activeTab !== 'approved' && (
                    <th className="w-10 px-4 py-3">
                      <button onClick={toggleAll} className="text-gray-400 dark:text-gray-500 hover:text-blue-600">
                        {allPendingSelect
                          ? <CheckSquare size={16} className="text-blue-600" />
                          : <Square size={16} />}
                      </button>
                    </th>
                  )}
                  {['Employee', 'Department', 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Applied', 'Status', 'Actions'].map(
                    (h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {leaves.map((leave) => (
                  <tr
                    key={leave.id}
                    className={cn(
                      'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                      selected.has(leave.id) && 'bg-blue-50 dark:bg-blue-900/20',
                    )}
                  >
                    {/* Checkbox */}
                    {activeTab !== 'rejected' && activeTab !== 'approved' && (
                      <td className="px-4 py-3">
                        {leave.status === 'pending' && (
                          <button
                            onClick={() => toggleSelect(leave.id)}
                            className="text-gray-400 dark:text-gray-500 hover:text-blue-600"
                          >
                            {selected.has(leave.id)
                              ? <CheckSquare size={16} className="text-blue-600" />
                              : <Square size={16} />}
                          </button>
                        )}
                      </td>
                    )}

                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={leave.employee_name ?? '?'} src={leave.employee_avatar} size="sm" />
                        <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[120px]">
                          {leave.employee_name ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{leave.department ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-gray-700 dark:text-gray-200">
                        {leave.leave_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      {formatDate(leave.start_date, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      {formatDate(leave.end_date, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{leave.total_days}d</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[160px]">
                      <span className="truncate block">{leave.reason}</span>
                      {leave.rejection_reason && (
                        <span className="text-xs text-red-500 block mt-0.5">
                          Reason: {leave.rejection_reason}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {timeAgo(leave.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={leave.status}
                        className={LEAVE_STATUS_COLORS[leave.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {leave.status === 'pending' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => approve(leave.id)}
                            disabled={approving}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700
                              hover:bg-green-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={() => setRejectLeave(leave)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700
                              hover:bg-red-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            <X size={12} /> Reject
                          </button>
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

      {/* Reject modal */}
      <RejectModal leave={rejectLeave} onClose={() => setRejectLeave(null)} />
    </div>
  )
}

export default LeaveApprovals
