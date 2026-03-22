import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import EmptyState from '@/components/common/EmptyState'
import toast from 'react-hot-toast'
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_COLORS,
} from '@/types/onboarding.types'
import type { SLAConfig, SLABreach } from '@/types/onboarding.types'

const CONFIGURABLE_STAGES = [
  'offer_sent', 'offer_accepted', 'pre_onboarding', 'joined',
  'training', 'bench',
]

const ESCALATION_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'manager', label: 'Manager' },
]

const SLAConfigPanel = () => {
  const [showCreate, setShowCreate] = useState(false)
  const [newStage, setNewStage] = useState('')
  const [newMaxDays, setNewMaxDays] = useState(7)
  const [newEscRole, setNewEscRole] = useState('admin')
  const [newAutoNotify, setNewAutoNotify] = useState(true)
  const [breachFilter, setBreachFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const qc = useQueryClient()

  const { data: configs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['sla-configs'],
    queryFn: () => onboardingService.getSLAConfigs(),
  })

  const { data: breaches = [], isLoading: loadingBreaches } = useQuery({
    queryKey: ['sla-breaches', breachFilter],
    queryFn: () => onboardingService.getSLABreaches(
      breachFilter === 'all' ? undefined : { resolved: breachFilter === 'resolved' },
    ),
  })

  const createMut = useMutation({
    mutationFn: () => onboardingService.createSLAConfig({
      stage: newStage, max_days: newMaxDays,
      escalation_role: newEscRole, auto_notify: newAutoNotify,
    }),
    onSuccess: () => {
      toast.success('SLA config created')
      qc.invalidateQueries({ queryKey: ['sla-configs'] })
      setShowCreate(false)
      setNewStage('')
      setNewMaxDays(7)
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => onboardingService.deleteSLAConfig(id),
    onSuccess: () => {
      toast.success('SLA config deleted')
      qc.invalidateQueries({ queryKey: ['sla-configs'] })
    },
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      onboardingService.updateSLAConfig(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla-configs'] })
    },
  })

  const resolveMut = useMutation({
    mutationFn: (breachId: string) => onboardingService.resolveSLABreach(breachId),
    onSuccess: () => {
      toast.success('Breach resolved')
      qc.invalidateQueries({ queryKey: ['sla-breaches'] })
    },
  })

  const usedStages = new Set(configs.map((c) => c.stage))
  const availableStages = CONFIGURABLE_STAGES.filter((s) => !usedStages.has(s))

  if (loadingConfigs) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="space-y-6">
      {/* SLA Configs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Stage SLA Deadlines
          </h2>
          {availableStages.length > 0 && (
            <Button
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => {
                setNewStage(availableStages[0])
                setShowCreate(true)
              }}
            >
              Add SLA Rule
            </Button>
          )}
        </div>

        {configs.length === 0 ? (
          <EmptyState
            title="No SLA rules configured"
            description="Add SLA deadlines to track how long employees can stay in each onboarding stage."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {configs.map((config) => (
              <div
                key={config.id}
                className={`card p-4 ${!config.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Badge
                      label={EMPLOYEE_STATUS_LABELS[config.stage] || config.stage}
                      className={EMPLOYEE_STATUS_COLORS[config.stage] || 'bg-gray-100 text-gray-600'}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {config.max_days} days
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Escalates to: <span className="font-medium">{config.escalation_role}</span>
                    </p>
                    {config.auto_notify && (
                      <p className="text-xs text-blue-500 mt-0.5">Auto-notify enabled</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleMut.mutate({ id: config.id, is_active: !config.is_active })}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1"
                      title={config.is_active ? 'Disable' : 'Enable'}
                    >
                      {config.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteMut.mutate(config.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SLA Breaches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            SLA Breaches
          </h2>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
            {(['open', 'resolved', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setBreachFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  breachFilter === f
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loadingBreaches ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : breaches.length === 0 ? (
          <EmptyState
            title="No breaches found"
            description={breachFilter === 'open' ? 'All employees are within SLA limits.' : 'No breaches match this filter.'}
            compact
          />
        ) : (
          <div className="space-y-2">
            {breaches.map((breach) => (
              <div key={breach.id} className="card p-3 flex items-center gap-3">
                {breach.resolved_at ? (
                  <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      label={EMPLOYEE_STATUS_LABELS[breach.stage] || breach.stage}
                      className={`text-[10px] px-1.5 py-0 ${EMPLOYEE_STATUS_COLORS[breach.stage] || 'bg-gray-100 text-gray-600'}`}
                    />
                    <span className="text-sm text-gray-900 dark:text-white font-medium">
                      {breach.actual_days}d / {breach.sla_days}d limit
                    </span>
                    <span className="text-xs text-red-500 font-medium">
                      +{breach.actual_days - breach.sla_days}d overdue
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Breached: {new Date(breach.breached_at).toLocaleDateString('en-IN')}
                    {breach.resolved_at && ` · Resolved: ${new Date(breach.resolved_at).toLocaleDateString('en-IN')}`}
                  </p>
                </div>
                {!breach.resolved_at && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={resolveMut.isPending}
                    onClick={() => resolveMut.mutate(breach.id)}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create SLA Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add SLA Rule"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stage
            </label>
            <select
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              className="input w-full"
            >
              {availableStages.map((s) => (
                <option key={s} value={s}>{EMPLOYEE_STATUS_LABELS[s] || s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max Days
            </label>
            <input
              type="number"
              value={newMaxDays}
              onChange={(e) => setNewMaxDays(parseInt(e.target.value) || 7)}
              min={1}
              max={365}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Escalation Role
            </label>
            <select
              value={newEscRole}
              onChange={(e) => setNewEscRole(e.target.value)}
              className="input w-full"
            >
              {ESCALATION_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newAutoNotify}
              onChange={(e) => setNewAutoNotify(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">Auto-notify on breach</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              disabled={!newStage}
              loading={createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SLAConfigPanel
