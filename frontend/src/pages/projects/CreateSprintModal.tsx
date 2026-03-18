import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { sprintService } from '@/services/sprint.service'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import DatePicker from '@/components/common/DatePicker'

interface Props {
  projectId: string
  onClose: () => void
}

const CreateSprintModal = ({ projectId, onClose }: Props) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
    capacity: '',
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      sprintService.create(projectId, {
        name: form.name,
        goal: form.goal || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      }),
    onSuccess: () => {
      toast.success('Sprint created')
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create sprint'),
  })

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  return (
    <Modal open onClose={onClose} title="Create Sprint" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Sprint Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Sprint 1"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Sprint Goal</label>
          <textarea
            rows={2}
            value={form.goal}
            onChange={(e) => set('goal', e.target.value)}
            placeholder="What do we want to achieve in this sprint?"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm resize-none
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Start Date</label>
            <DatePicker value={form.start_date} onChange={(v) => set('start_date', v)} max={form.end_date} placeholder="Start date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">End Date</label>
            <DatePicker value={form.end_date} onChange={(v) => set('end_date', v)} min={form.start_date} placeholder="End date" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
            Story Point Capacity
          </label>
          <input
            type="number"
            min="0"
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            placeholder="e.g. 40"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            loading={isPending}
            disabled={!form.name.trim()}
            onClick={() => mutate()}
          >
            Create Sprint
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CreateSprintModal
