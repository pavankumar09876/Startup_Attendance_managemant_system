import { useState, KeyboardEvent } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, Bug, BookOpen, CheckSquare, Zap } from 'lucide-react'

import { taskService } from '@/services/task.service'
import { projectService } from '@/services/project.service'
import type { TaskStatus, TaskPriority, IssueType, ProjectMember } from '@/types/project.types'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import DatePicker from '@/components/common/DatePicker'
import { cn } from '@/utils/cn'

const schema = z.object({
  title:           z.string().min(1, 'Title is required'),
  description:     z.string().optional(),
  status:          z.string() as z.ZodType<TaskStatus>,
  priority:        z.string() as z.ZodType<TaskPriority>,
  issue_type:      z.string() as z.ZodType<IssueType>,
  assignee_id:     z.string().optional(),
  due_date:        z.string().optional(),
  estimated_hours: z.coerce.number().min(0).optional(),
})

type FormData = z.infer<typeof schema>

const ISSUE_TYPES: { value: IssueType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'task',  label: 'Task',  icon: <CheckSquare size={13} />, color: 'text-blue-600 bg-blue-50 border-blue-200 ring-blue-400' },
  { value: 'bug',   label: 'Bug',   icon: <Bug size={13} />,         color: 'text-red-600 bg-red-50 border-red-200 ring-red-400' },
  { value: 'story', label: 'Story', icon: <BookOpen size={13} />,    color: 'text-green-600 bg-green-50 border-green-200 ring-green-400' },
  { value: 'epic',  label: 'Epic',  icon: <Zap size={13} />,         color: 'text-purple-600 bg-purple-50 border-purple-200 ring-purple-400' },
]

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: 'bg-gray-100 text-gray-600 border-gray-200 ring-gray-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
  { value: 'medium',   label: 'Medium',   color: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500' },
  { value: 'high',     label: 'High',     color: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-50 text-red-700 border-red-200 ring-red-500' },
]

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'blocked']

interface Props {
  projectId: string
  defaultStatus: TaskStatus
  members?: ProjectMember[]
  sprintId?: string
  onClose: () => void
}

const CreateTaskModal = ({ projectId, defaultStatus, members: membersProp, sprintId, onClose }: Props) => {
  const [labels, setLabels]       = useState<string[]>([])
  const [labelInput, setLabelInput] = useState('')
  const [epicId, setEpicId]       = useState('')
  const queryClient = useQueryClient()

  const { data: fetchedMembers = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !membersProp,
  })
  const members = membersProp ?? fetchedMembers

  // Available epics in this project
  const { data: projectEpics = [] } = useQuery({
    queryKey: ['project-epics', projectId],
    queryFn: () => taskService.getProjectTasks(projectId, { issue_type: 'epic', limit: 50 }),
  })

  const {
    register, handleSubmit, watch, setValue, control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: defaultStatus, priority: 'medium', issue_type: 'task' },
  })

  const watchedPriority  = watch('priority')
  const watchedIssueType = watch('issue_type')

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      taskService.create(projectId, { ...data, labels, sprint_id: sprintId, epic_id: epicId || undefined }),
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            {...register('title')}
            placeholder="What needs to be done?"
            autoFocus
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'dark:bg-gray-900 dark:text-gray-100',
              errors.title ? 'border-red-400' : 'border-gray-300 dark:border-gray-600',
            )}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Description</label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Add more details…"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Issue Type selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Issue Type</label>
          <div className="grid grid-cols-4 gap-2">
            {ISSUE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setValue('issue_type', t.value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold border transition-all',
                  watchedIssueType === t.value
                    ? `${t.color} ring-2`
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Priority</label>
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
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Column</label>
            <select
              {...register('status')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Assign to</label>
            <select
              {...register('assignee_id')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Due Date</label>
            <Controller name="due_date" control={control} render={({ field }) => (
              <DatePicker value={field.value ?? ''} onChange={field.onChange} placeholder="Select due date" />
            )} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Estimated Hours
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              {...register('estimated_hours')}
              placeholder="e.g. 4"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Labels</label>
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
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Epic (only for non-epic tasks, and only if epics exist) */}
        {watchedIssueType !== 'epic' && projectEpics.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Epic</label>
            <select
              value={epicId}
              onChange={(e) => setEpicId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">No epic</option>
              {projectEpics.map((ep) => (
                <option key={ep.id} value={ep.id}>{ep.title}</option>
              ))}
            </select>
          </div>
        )}

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
