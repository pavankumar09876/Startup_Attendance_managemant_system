import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, MessageSquare,
} from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import EmptyState from '@/components/common/EmptyState'
import toast from 'react-hot-toast'
import type { PendingRequest, ApprovalStep } from '@/types/onboarding.types'

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  skipped:  'bg-gray-100 text-gray-500',
}

const REQUEST_STATUS_COLORS: Record<string, string> = {
  pending_review: 'bg-yellow-100 text-yellow-700',
  approved:       'bg-green-100 text-green-700',
  rejected:       'bg-red-100 text-red-700',
}

const ApprovalChainPanel = () => {
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectRequestId, setRejectRequestId] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const qc = useQueryClient()

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['onboarding-requests', statusFilter],
    queryFn: () => onboardingService.getRequests(statusFilter || undefined),
  })

  const { data: requestDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['onboarding-request', expandedId],
    queryFn: () => onboardingService.getRequestDetail(expandedId!),
    enabled: !!expandedId,
  })

  const approveMut = useMutation({
    mutationFn: (requestId: string) => onboardingService.approveRequest(requestId),
    onSuccess: (data) => {
      toast.success(data.message || 'Approved')
      qc.invalidateQueries({ queryKey: ['onboarding-requests'] })
      qc.invalidateQueries({ queryKey: ['onboarding-request', expandedId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Approve failed'),
  })

  const rejectMut = useMutation({
    mutationFn: () => onboardingService.rejectRequest(rejectRequestId, rejectReason),
    onSuccess: () => {
      toast.success('Request rejected')
      setShowRejectModal(false)
      setRejectReason('')
      qc.invalidateQueries({ queryKey: ['onboarding-requests'] })
      qc.invalidateQueries({ queryKey: ['onboarding-request', expandedId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Reject failed'),
  })

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Employee Creation Requests
        </h3>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input text-sm"
        >
          <option value="">All</option>
          <option value="pending_review">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No requests"
          description="No employee creation requests found."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="card">
              {/* Header */}
              <button
                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Request #{req.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Level {req.current_approval_level}/{req.max_approval_level}
                      {req.created_at && (
                        <span className="ml-2">
                          {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    label={req.status.replace(/_/g, ' ')}
                    className={REQUEST_STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}
                  />
                  {expandedId === req.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Expanded detail */}
              {expandedId === req.id && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
                  {loadingDetail ? (
                    <div className="flex justify-center py-4"><Spinner /></div>
                  ) : requestDetail ? (
                    <>
                      {/* Approval chain visualization */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                          Approval Chain
                        </h4>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                          {(requestDetail.steps || []).map((step, idx) => (
                            <div key={step.id} className="flex items-center gap-2">
                              <StepCard step={step} />
                              {idx < (requestDetail.steps?.length || 0) - 1 && (
                                <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      {req.status === 'pending_review' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <Button
                            size="sm"
                            leftIcon={<CheckCircle2 size={14} />}
                            loading={approveMut.isPending}
                            onClick={() => approveMut.mutate(req.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            leftIcon={<XCircle size={14} />}
                            onClick={() => {
                              setRejectRequestId(req.id)
                              setShowRejectModal(true)
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        open={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason('') }}
        title="Reject Request"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for rejection *
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="input w-full"
              placeholder="Please provide a reason..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!rejectReason.trim()}
              loading={rejectMut.isPending}
              onClick={() => rejectMut.mutate()}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const StepCard = ({ step }: { step: ApprovalStep }) => (
  <div className={`flex-shrink-0 rounded-lg border p-3 min-w-[140px] ${
    step.status === 'approved'
      ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800'
      : step.status === 'rejected'
      ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'
      : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700'
  }`}>
    <div className="flex items-center gap-2 mb-1">
      {step.status === 'approved' ? (
        <CheckCircle2 size={14} className="text-green-500" />
      ) : step.status === 'rejected' ? (
        <XCircle size={14} className="text-red-500" />
      ) : (
        <Clock size={14} className="text-amber-500" />
      )}
      <span className="text-xs font-medium text-gray-900 dark:text-white">
        Level {step.level}
      </span>
    </div>
    <p className="text-xs text-gray-500 capitalize">{step.approver_role}</p>
    <Badge
      label={step.status}
      className={`mt-1 text-[10px] ${STATUS_COLORS[step.status] || 'bg-gray-100 text-gray-500'}`}
    />
    {step.comment && (
      <div className="flex items-start gap-1 mt-1.5">
        <MessageSquare size={10} className="text-gray-400 mt-0.5" />
        <p className="text-[10px] text-gray-400 line-clamp-2">{step.comment}</p>
      </div>
    )}
  </div>
)

export default ApprovalChainPanel
