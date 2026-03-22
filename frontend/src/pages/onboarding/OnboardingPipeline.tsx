import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, ChevronRight, Search, History } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import Badge from '@/components/common/Badge'
import Avatar from '@/components/common/Avatar'
import EmptyState from '@/components/common/EmptyState'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import toast from 'react-hot-toast'
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_COLORS,
} from '@/types/onboarding.types'
import type { PipelineEmployee } from '@/types/onboarding.types'
import EmployeeChecklistPanel from './EmployeeChecklistPanel'
import EmployeeTimeline from './EmployeeTimeline'

const PIPELINE_STATUSES = [
  'offer_sent', 'offer_accepted', 'pre_onboarding', 'joined',
  'invited', 'active', 'training', 'bench',
]

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  offer_sent:      ['offer_accepted', 'terminated'],
  offer_accepted:  ['pre_onboarding', 'terminated'],
  pre_onboarding:  ['joined', 'terminated'],
  joined:          ['active', 'training', 'terminated'],
  invited:         ['active', 'terminated'],
  active:          ['training', 'bench', 'suspended', 'terminated'],
  training:        ['active', 'bench', 'suspended', 'terminated'],
  bench:           ['active', 'training', 'suspended', 'terminated'],
  suspended:       ['active', 'terminated'],
}

const OnboardingPipeline = () => {
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<PipelineEmployee | null>(null)
  const [showTransition, setShowTransition] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [transitionTarget, setTransitionTarget] = useState('')
  const [transitionNotes, setTransitionNotes] = useState('')
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkTransition, setShowBulkTransition] = useState(false)
  const [bulkTarget, setBulkTarget] = useState('')
  const [bulkNotes, setBulkNotes] = useState('')
  const qc = useQueryClient()

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['onboarding-pipeline', selectedStatus],
    queryFn: () => onboardingService.getPipeline(selectedStatus),
  })

  const transitionMut = useMutation({
    mutationFn: () =>
      onboardingService.transitionStatus(
        selectedEmployee!.id, transitionTarget, transitionNotes || undefined,
      ),
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['onboarding-pipeline'] })
      setShowTransition(false)
      setSelectedEmployee(null)
      setTransitionTarget('')
      setTransitionNotes('')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Transition failed'),
  })

  const bulkTransitionMut = useMutation({
    mutationFn: () =>
      onboardingService.bulkTransition(
        Array.from(selectedIds), bulkTarget, bulkNotes || undefined,
      ),
    onSuccess: (result) => {
      toast.success(`${result.succeeded} transitioned, ${result.failed.length} failed`)
      qc.invalidateQueries({ queryKey: ['onboarding-pipeline'] })
      setShowBulkTransition(false)
      setSelectedIds(new Set())
      setBulkTarget('')
      setBulkNotes('')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Bulk transition failed'),
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)))
    }
  }

  const inviteMut = useMutation({
    mutationFn: (id: string) => onboardingService.sendInvite(id),
    onSuccess: (data) => {
      toast.success(data.message)
      qc.invalidateQueries({ queryKey: ['onboarding-pipeline'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to send invite'),
  })

  const filtered = employees.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employee_id.toLowerCase().includes(q)
    )
  })

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <select
          value={selectedStatus || ''}
          onChange={(e) => setSelectedStatus(e.target.value || undefined)}
          className="input"
        >
          <option value="">All Statuses</option>
          {PIPELINE_STATUSES.map((s) => (
            <option key={s} value={s}>{EMPLOYEE_STATUS_LABELS[s] || s}</option>
          ))}
        </select>
      </div>

      {/* Bulk action bar */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="rounded"
            />
            Select all ({filtered.length})
          </label>
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowBulkTransition(true)}
              >
                Bulk Transition
              </Button>
            </>
          )}
        </div>
      )}

      {/* Pipeline cards */}
      {filtered.length === 0 ? (
        <EmptyState title="No employees found" description="No employees match the current filters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <div key={emp.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(emp.id)}
                  onChange={() => toggleSelect(emp.id)}
                  className="rounded mt-1 flex-shrink-0"
                />
                <Avatar name={`${emp.first_name} ${emp.last_name}`} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {emp.first_name} {emp.last_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{emp.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      label={EMPLOYEE_STATUS_LABELS[emp.status] || emp.status}
                      className={EMPLOYEE_STATUS_COLORS[emp.status] || 'bg-gray-100 text-gray-600'}
                    />
                    {emp.designation && (
                      <span className="text-xs text-gray-400 truncate">{emp.designation}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                {ALLOWED_TRANSITIONS[emp.status] && (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<ChevronRight size={14} />}
                    onClick={() => {
                      setSelectedEmployee(emp)
                      setShowTransition(true)
                    }}
                  >
                    Transition
                  </Button>
                )}
                {['offer_accepted', 'pre_onboarding'].includes(emp.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Send size={14} />}
                    loading={inviteMut.isPending}
                    onClick={() => inviteMut.mutate(emp.id)}
                  >
                    Send Invite
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedEmployee(emp)
                    setShowChecklist(true)
                  }}
                >
                  Checklist
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<History size={14} />}
                  onClick={() => {
                    setSelectedEmployee(emp)
                    setShowTimeline(true)
                  }}
                >
                  Timeline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transition modal */}
      <Modal
        open={showTransition}
        onClose={() => { setShowTransition(false); setTransitionTarget(''); setTransitionNotes('') }}
        title={`Transition: ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Status
            </label>
            <select
              value={transitionTarget}
              onChange={(e) => setTransitionTarget(e.target.value)}
              className="input w-full"
            >
              <option value="">Select status...</option>
              {(ALLOWED_TRANSITIONS[selectedEmployee?.status || ''] || []).map((s) => (
                <option key={s} value={s}>{EMPLOYEE_STATUS_LABELS[s] || s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              rows={3}
              className="input w-full"
              placeholder="Reason for transition..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowTransition(false)}>Cancel</Button>
            <Button
              disabled={!transitionTarget}
              loading={transitionMut.isPending}
              onClick={() => transitionMut.mutate()}
            >
              Confirm Transition
            </Button>
          </div>
        </div>
      </Modal>

      {/* Checklist modal */}
      <Modal
        open={showChecklist}
        onClose={() => { setShowChecklist(false); setSelectedEmployee(null) }}
        title={`Checklist: ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`}
        size="xl"
      >
        {selectedEmployee && <EmployeeChecklistPanel employeeId={selectedEmployee.id} />}
      </Modal>

      {/* Timeline modal */}
      <Modal
        open={showTimeline}
        onClose={() => { setShowTimeline(false); setSelectedEmployee(null) }}
        title={`Timeline: ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`}
        size="lg"
      >
        {selectedEmployee && (
          <EmployeeTimeline
            employeeId={selectedEmployee.id}
            currentStatus={selectedEmployee.status}
          />
        )}
      </Modal>

      {/* Bulk Transition modal */}
      <Modal
        open={showBulkTransition}
        onClose={() => { setShowBulkTransition(false); setBulkTarget(''); setBulkNotes('') }}
        title={`Bulk Transition (${selectedIds.size} employees)`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Transition {selectedIds.size} selected employee(s) to a new status.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Status
            </label>
            <select
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
              className="input w-full"
            >
              <option value="">Select status...</option>
              {['offer_accepted', 'pre_onboarding', 'joined', 'active', 'training', 'bench', 'suspended', 'terminated'].map((s) => (
                <option key={s} value={s}>{EMPLOYEE_STATUS_LABELS[s] || s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              rows={2}
              className="input w-full"
              placeholder="Reason for bulk transition..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowBulkTransition(false)}>Cancel</Button>
            <Button
              disabled={!bulkTarget}
              loading={bulkTransitionMut.isPending}
              onClick={() => bulkTransitionMut.mutate()}
            >
              Transition {selectedIds.size} Employees
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default OnboardingPipeline
