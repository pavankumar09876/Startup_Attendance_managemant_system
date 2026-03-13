import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sprintService } from '@/services/sprint.service'
import type { Sprint } from '@/types/project.types'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'

interface Props {
  sprint: Sprint
  plannedSprints: Sprint[]
  projectId: string
  onClose: () => void
}

const CompleteSprintModal = ({ sprint, plannedSprints, projectId, onClose }: Props) => {
  const queryClient = useQueryClient()
  const [targetSprintId, setTargetSprintId] = useState<string>('')

  const incompleteCount = sprint.total_tasks - sprint.completed_tasks

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      sprintService.complete(sprint.id, {
        move_incomplete_to_sprint_id: targetSprintId || null,
      }),
    onSuccess: () => {
      toast.success(`Sprint "${sprint.name}" completed`)
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to complete sprint'),
  })

  return (
    <Modal open onClose={onClose} title={`Complete "${sprint.name}"`} size="sm">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{sprint.completed_tasks}</span> of{' '}
            <span className="font-semibold">{sprint.total_tasks}</span> tasks completed.
            {incompleteCount > 0 && (
              <> <span className="font-semibold">{incompleteCount}</span> incomplete {incompleteCount === 1 ? 'task' : 'tasks'} will be moved.</>
            )}
          </p>
        </div>

        {incompleteCount > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Move incomplete tasks to
            </label>
            <select
              value={targetSprintId}
              onChange={(e) => setTargetSprintId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Backlog</option>
              {plannedSprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button className="flex-1" loading={isPending} onClick={() => mutate()}>
            Complete Sprint
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CompleteSprintModal
