import { useState, KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

import { taskService } from '@/services/task.service'
import type { TaskStatus, TaskPriority, ProjectMember } from '@/types/project.types'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const schema = z.object({
  title:           z.string().min(1, 'Title is required'),
  description:     z.string().optional(),
  status:          z.string() as z.ZodType<TaskStatus>,
  priority:        z.string() as z.ZodType<TaskPriority>,
  assignee_id:     z.string().optional(),
  due_date:        z.string().optional(),
  estimated_hours: z.coerce.number().min(0).optional(),
})

type FormData = z.infer<typeof schema>

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: 'bg-gray-100 text-gray-600 border-gray-200 ring-gray-400' },
  { value: 'medium',   label: 'Medium',   color: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500' },
  { value: 'high',     label: 'High',     color: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-50 text-red-700 border-red-200 ring-red-500' },
]

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'blocked']

interface Props {
  projectId: string
  defaultStatus: TaskStatus
  members: ProjectMember[]
  onClose: () => void
}

const CreateTaskModal = ({ projectId, defaultStatus, members, onClose }: Props) => {
  const [labels, setLabels]       = useState<string[]>([])
  const [labelInput, setLabelInput] = useState('')
  const queryClient = useQueryClient()

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: defaultStatus, priority: 'medium' },
  })

  const watchedPriority = watch('priority')
  const watchedStatus   = watch('status')

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      taskService.create(projectId, { ...data, labels }),
    onSuccess: () => {
      toast.success('Task created!')
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my'] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to create task'),
  })

  const addLabel = () => {
    const val = labelInput.trim()
    if (val && !labels.includes(val)) {
      setLabels((prev) => [...prev, val])
    }
    setLabelInput('')
  }

  const handleLabelKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addLabel() }
  }

  return (
    <Modal open onClose={onClose} title="Create Task" size="md">
      <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            {...register('title')}
            placeholder="What needs to be done?"
            autoFocus
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              errors.title ? 'border-red-400' : 'border-gray-300',
            )}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Add more details…"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
          />
        </div>

        {/* Priority selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setValue('priority', p.value)}
                className={cn(
                  'px-2 py-2 rounded-lg text-xs font-semibold border transition-all',
                  watchedPriority === p.value
                    ? `${p.color} ring-2`
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status + Assignee row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Column</label>
            <select
              {...register('status')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign to</label>
            <select
              {...register('assignee_id')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Due date + Estimated hours */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
            <input
              type="date"
              {...register('due_date')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Estimated Hours
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              {...register('estimated_hours')}
              placeholder="e.g. 4"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Labels</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {labels.map((l) => (
              <span key={l} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700
                px-2 py-0.5 rounded-full">
                {l}
                <button
                  type="button"
                  onClick={() => setLabels((prev) => prev.filter((x) => x !== l))}
                  className="text-blue-400 hover:text-blue-700"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={handleLabelKeyDown}
            onBlur={addLabel}
            placeholder="Type a label and press Enter…"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isPending}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateTaskModal
