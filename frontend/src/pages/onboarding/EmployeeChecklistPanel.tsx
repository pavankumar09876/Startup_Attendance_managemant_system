import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, ListChecks } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import toast from 'react-hot-toast'
import { CHECKLIST_CATEGORIES } from '@/types/onboarding.types'

const CATEGORY_COLORS: Record<string, string> = {
  hr:       'bg-purple-100 text-purple-700',
  it:       'bg-blue-100 text-blue-700',
  employee: 'bg-green-100 text-green-700',
  finance:  'bg-amber-100 text-amber-700',
  general:  'bg-gray-100 text-gray-600',
}

interface Props {
  employeeId: string
}

const EmployeeChecklistPanel = ({ employeeId }: Props) => {
  const [showAssign, setShowAssign] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const qc = useQueryClient()

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['employee-checklist', employeeId],
    queryFn: () => onboardingService.getEmployeeChecklist(employeeId),
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () => onboardingService.getChecklistTemplates(),
    enabled: showAssign,
  })

  const assignMut = useMutation({
    mutationFn: () => onboardingService.assignChecklist(employeeId, selectedTemplateId),
    onSuccess: () => {
      toast.success('Checklist assigned')
      setShowAssign(false)
      setSelectedTemplateId('')
      qc.invalidateQueries({ queryKey: ['employee-checklist', employeeId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to assign'),
  })

  const toggleMut = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      onboardingService.updateChecklistItem(itemId, { is_completed: completed }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-checklist', employeeId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Update failed'),
  })

  if (isLoading) {
    return <div className="flex justify-center py-10"><Spinner /></div>
  }

  const items = checklist?.items || []
  const progress = checklist?.progress

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {progress && progress.total > 0 && (
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-gray-600 dark:text-gray-400">
              {progress.completed}/{progress.total} completed
              {progress.required_total > 0 && (
                <span className="text-xs ml-1">
                  ({progress.required_completed}/{progress.required_total} required)
                </span>
              )}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {progress.percentage.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Assign template button */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Checklist Items</h4>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ListChecks size={14} />}
          onClick={() => setShowAssign(!showAssign)}
        >
          Assign Template
        </Button>
      </div>

      {/* Template assignment */}
      {showAssign && (
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="input flex-1"
          >
            <option value="">Select template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.items.length} items)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selectedTemplateId}
            loading={assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            Assign
          </Button>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <EmptyState
          title="No checklist items"
          description="Assign a template to create checklist items."
          compact
        />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 py-3">
              <button
                onClick={() =>
                  toggleMut.mutate({
                    itemId: item.id,
                    completed: !item.is_completed,
                  })
                }
                className="mt-0.5 flex-shrink-0"
                disabled={toggleMut.isPending}
              >
                {item.is_completed ? (
                  <CheckCircle2 size={18} className="text-green-500" />
                ) : (
                  <Circle size={18} className="text-gray-300 dark:text-gray-600" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${
                  item.is_completed
                    ? 'text-gray-400 line-through'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {item.title}
                  {item.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    label={CHECKLIST_CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                    className={CATEGORY_COLORS[item.category] || CATEGORY_COLORS.general}
                  />
                  <span className="text-xs text-gray-400">{item.assignee_role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default EmployeeChecklistPanel
