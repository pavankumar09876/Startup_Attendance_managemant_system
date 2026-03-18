import { useState, useRef, KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Check, Plus, Clock, Send, X, Edit2, ChevronDown, Bug, BookOpen, CheckSquare, Zap, Activity, ArrowRight } from 'lucide-react'

import { taskService } from '@/services/task.service'
import type { Task, TaskStatus, TaskPriority, IssueType, ProjectMember, SubTask, TaskActivity, EpicProgress } from '@/types/project.types'
import { formatDate, timeAgo } from '@/utils/formatDate'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import DatePicker from '@/components/common/DatePicker'
import { cn } from '@/utils/cn'

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done', 'blocked']
const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'critical']

const ISSUE_TYPE_CONFIG: Record<IssueType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  task:  { label: 'Task',  icon: <CheckSquare size={12} />, color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  bug:   { label: 'Bug',   icon: <Bug size={12} />,         color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  story: { label: 'Story', icon: <BookOpen size={12} />,    color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  epic:  { label: 'Epic',  icon: <Zap size={12} />,         color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

// ── Inline editable field ──────────────────────────────────────────────────────
const InlineEdit = ({
  value,
  onSave,
  multiline = false,
  className = '',
  readOnly = false,
}: {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
  className?: string
  readOnly?: boolean
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)

  const commit = () => {
    if (draft.trim() && draft !== value) onSave(draft.trim())
    setEditing(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setDraft(value); setEditing(false) }
    if (!multiline && e.key === 'Enter') { e.preventDefault(); commit() }
  }

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: React.ChangeEvent<any>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKey,
      autoFocus: true,
      className: cn(
        'w-full px-2 py-1 rounded border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:bg-gray-800 dark:text-gray-100 dark:border-blue-500',
        className,
      ),
    }
    return multiline
      ? <textarea rows={4} {...shared} className={`${shared.className} resize-none`} />
      : <input {...shared} />
  }

  if (readOnly) {
    return (
      <div className={cn('px-1 -mx-1', className)}>
        <span className={cn(
          'flex-1',
          multiline ? 'whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300' : 'font-semibold text-lg text-gray-900 dark:text-gray-100',
        )}>
          {value || <span className="text-gray-400 dark:text-gray-400 italic">{multiline ? 'No description.' : 'Untitled'}</span>}
        </span>
      </div>
    )
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true) }}
      className={cn(
        'group flex items-start gap-1 cursor-text rounded px-1 -mx-1 hover:bg-gray-50 dark:hover:bg-gray-800',
        className,
      )}
    >
      <span className={cn(
        'flex-1',
        multiline ? 'whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300' : 'font-semibold text-lg text-gray-900 dark:text-gray-100',
      )}>
        {value || <span className="text-gray-400 dark:text-gray-400 italic">{multiline ? 'Add description…' : 'Untitled'}</span>}
      </span>
      <Edit2 size={12} className="shrink-0 mt-1.5 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

// ── Log Time mini form ─────────────────────────────────────────────────────────
const LogTimeForm = ({
  taskId,
  onSuccess,
}: {
  taskId: string
  onSuccess: () => void
}) => {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ hours: '', description: '', date: today })
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      taskService.logTime(taskId, {
        hours: Number(form.hours),
        description: form.description || undefined,
        date: form.date,
      }),
    onSuccess: () => {
      toast.success('Time logged!')
      queryClient.invalidateQueries({ queryKey: ['task-timelogs', taskId] })
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setForm({ hours: '', description: '', date: today })
      onSuccess()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min="0.25"
          step="0.25"
          value={form.hours}
          onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
          placeholder="Hours (e.g. 1.5)"
          className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
        />
        <DatePicker value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} placeholder="Date" />
      </div>
      <input
        value={form.description}
        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        placeholder="What did you work on? (optional)"
        className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          loading={isPending}
          disabled={!form.hours || Number(form.hours) <= 0}
          onClick={() => mutate()}
        >
          Log Time
        </Button>
        <Button size="sm" variant="secondary" onClick={onSuccess}>Cancel</Button>
      </div>
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
interface Props {
  task: Task
  members: ProjectMember[]
  onClose: () => void
  canManage?: boolean
}

const TaskDetailModal = ({ task: initialTask, members, onClose, canManage = false }: Props) => {
  const [showLogTime, setShowLogTime] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [newSubtask, setNewSubtask]   = useState('')
  const queryClient = useQueryClient()

  // Live task data (updates optimistically)
  const { data: task = initialTask } = useQuery({
    queryKey: ['task', initialTask.id],
    queryFn: () => taskService.get(initialTask.id),
    initialData: initialTask,
    staleTime: 1000 * 30,
  })

  const { data: subtasks = [] } = useQuery({
    queryKey: ['task-subtasks', task.id],
    queryFn: () => taskService.getSubtasks(task.id),
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['task-comments', task.id],
    queryFn: () => taskService.getComments(task.id),
  })

  const { data: timeLogs = [] } = useQuery({
    queryKey: ['task-timelogs', task.id],
    queryFn: () => taskService.getTimeLogs(task.id),
  })

  const { data: activities = [] } = useQuery({
    queryKey: ['task-activity', task.id],
    queryFn: () => taskService.getActivity(task.id),
  })

  const isEpic = task.issue_type === 'epic'

  // Epic children + progress (only when viewing an epic)
  const { data: epicChildren = [] } = useQuery({
    queryKey: ['epic-children', task.id],
    queryFn: () => taskService.getEpicChildren(task.id),
    enabled: isEpic,
  })

  const { data: epicProgress } = useQuery({
    queryKey: ['epic-progress', task.id],
    queryFn: () => taskService.getEpicProgress(task.id),
    enabled: isEpic,
  })

  // Available epics in the project (for assigning non-epic tasks to an epic)
  const { data: projectEpics = [] } = useQuery({
    queryKey: ['project-epics', task.project_id],
    queryFn: () => taskService.getProjectTasks(task.project_id, { issue_type: 'epic', limit: 50 }),
    enabled: !isEpic,
  })

  const invalidateTask = () => {
    queryClient.invalidateQueries({ queryKey: ['task', task.id] })
    queryClient.invalidateQueries({ queryKey: ['project-tasks', task.project_id] })
    queryClient.invalidateQueries({ queryKey: ['tasks', 'my'] })
    queryClient.invalidateQueries({ queryKey: ['task-activity', task.id] })
    if (isEpic) {
      queryClient.invalidateQueries({ queryKey: ['epic-children', task.id] })
      queryClient.invalidateQueries({ queryKey: ['epic-progress', task.id] })
    }
    if (task.epic_id) {
      queryClient.invalidateQueries({ queryKey: ['epic-children', task.epic_id] })
      queryClient.invalidateQueries({ queryKey: ['epic-progress', task.epic_id] })
    }
  }

  // ── Update task fields ────────────────────────────────────────────────────
  const { mutate: updateField } = useMutation({
    mutationFn: (payload: Partial<Task>) => taskService.update(task.id, payload),
    onSuccess: () => invalidateTask(),
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Update failed'),
  })

  // ── Subtasks ──────────────────────────────────────────────────────────────
  const { mutate: addSubtask } = useMutation({
    mutationFn: (title: string) => taskService.createSubtask(task.id, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-subtasks', task.id] }),
  })

  const { mutate: toggleSubtask } = useMutation({
    mutationFn: ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) =>
      taskService.toggleSubtask(task.id, subtaskId, completed),
    onMutate: async ({ subtaskId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['task-subtasks', task.id] })
      const prev = queryClient.getQueryData<SubTask[]>(['task-subtasks', task.id])
      queryClient.setQueryData<SubTask[]>(
        ['task-subtasks', task.id],
        (old = []) => old.map((s) => (s.id === subtaskId ? { ...s, completed } : s)),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['task-subtasks', task.id], ctx.prev)
    },
  })

  const handleSubtaskAdd = () => {
    const title = newSubtask.trim()
    if (!title) return
    addSubtask(title)
    setNewSubtask('')
  }

  // ── Comments ──────────────────────────────────────────────────────────────
  const { mutate: postComment, isPending: commenting } = useMutation({
    mutationFn: (content: string) => taskService.addComment(task.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', task.id] })
      setCommentText('')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const handleCommentSubmit = (e?: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e && !(e.key === 'Enter' && (e.metaKey || e.ctrlKey))) return
    const text = commentText.trim()
    if (!text) return
    postComment(text)
  }

  const completedSubtasks = subtasks.filter((s) => s.completed).length
  const totalLoggedHours  = timeLogs.reduce((sum, l) => sum + l.hours, 0)

  return (
    // Full-screen overlay
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex overflow-hidden">

        {/* ── LEFT PANEL (60%) ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 border-r border-gray-100 dark:border-gray-700">

          {/* Title */}
          <InlineEdit
            value={task.title}
            onSave={(v) => updateField({ title: v })}
            readOnly={!canManage}
          />

          {/* Project tag */}
          {task.project_name && (
            <span className="inline-block mt-2 text-xs text-purple-600 bg-purple-50
              px-2 py-0.5 rounded-full">
              {task.project_name}
            </span>
          )}

          {/* Description */}
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-2">
              Description
            </p>
            <InlineEdit
              value={task.description ?? ''}
              onSave={(v) => updateField({ description: v })}
              multiline
              readOnly={!canManage}
            />
          </div>

          {/* Subtasks */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-1.5 text-gray-500 dark:text-gray-400 normal-case font-normal">
                    {completedSubtasks}/{subtasks.length}
                  </span>
                )}
              </p>
            </div>

            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-3">
                <div
                  className="h-1.5 bg-green-500 rounded-full transition-all"
                  style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 group">
                  <button
                    onClick={() => toggleSubtask({ subtaskId: s.id, completed: !s.completed })}
                    className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      s.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-green-400',
                    )}
                  >
                    {s.completed && <Check size={10} />}
                  </button>
                  <span className={cn(
                    'text-sm flex-1',
                    s.completed ? 'line-through text-gray-400 dark:text-gray-400' : 'text-gray-700 dark:text-gray-200',
                  )}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Add subtask input */}
            {canManage && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubtaskAdd()}
                  placeholder="Add a subtask…"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm
                    focus:outline-none focus:border-blue-400 focus:border-solid placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={handleSubtaskAdd}
                  disabled={!newSubtask.trim()}
                  className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100
                    disabled:opacity-40 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-3">
              Comments
            </p>

            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar name={c.user_name} src={c.user_avatar} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{c.user_name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-400">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}

              {comments.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-400 italic">No comments yet.</p>
              )}
            </div>

            {/* Comment input */}
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => handleCommentSubmit(e)}
                placeholder="Write a comment… (Ctrl+Enter to submit)"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm resize-none
                  focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-100"
              />
              <button
                onClick={() => handleCommentSubmit()}
                disabled={commenting || !commentText.trim()}
                className="self-end p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700
                  disabled:opacity-40 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* Activity log */}
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Activity size={12} />
              Activity
            </p>

            {activities.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-400 italic">No activity recorded yet.</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />

                <div className="space-y-3">
                  {activities.map((a) => (
                    <div key={a.id} className="flex gap-3 relative">
                      <div className={cn(
                        'w-[15px] h-[15px] rounded-full border-2 shrink-0 mt-0.5 z-10',
                        a.action === 'created'
                          ? 'bg-green-500 border-green-500'
                          : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-200 leading-snug">
                          <span className="font-medium">{a.actor_name}</span>
                          {a.action === 'created' && (
                            <span className="text-gray-500 dark:text-gray-400"> created this task</span>
                          )}
                          {a.action === 'updated' && a.field && (
                            <>
                              <span className="text-gray-500 dark:text-gray-400"> changed </span>
                              <span className="font-medium">{a.field}</span>
                            </>
                          )}
                        </p>
                        {a.action === 'updated' && (a.old_value || a.new_value) && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {a.old_value && (
                              <span className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded line-through">
                                {a.old_value.replace(/_/g, ' ')}
                              </span>
                            )}
                            <ArrowRight size={10} className="text-gray-400 shrink-0" />
                            {a.new_value && (
                              <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                                {a.new_value.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {timeAgo(a.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL (40%) ─────────────────────────────────────── */}
        <div className="w-72 xl:w-80 overflow-y-auto p-5 bg-gray-50 dark:bg-gray-800 space-y-5">

          {/* Close button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide">
              Details
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Issue Type */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Issue Type</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(ISSUE_TYPE_CONFIG) as IssueType[]).map((t) => {
                const cfg = ISSUE_TYPE_CONFIG[t]
                const active = (task.issue_type ?? 'task') === t
                return (
                  <button
                    key={t}
                    onClick={() => canManage && updateField({ issue_type: t })}
                    disabled={!canManage}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      active
                        ? `${cfg.color} ${cfg.bg} ring-2 ring-offset-1 ring-current`
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700',
                      !canManage && 'cursor-default opacity-80',
                    )}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Status</p>
            <div className="relative">
              <select
                value={task.status}
                onChange={(e) => updateField({ status: e.target.value as TaskStatus })}
                className={cn(
                  'w-full appearance-none pl-3 pr-8 py-2 rounded-lg border text-sm font-medium',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  STATUS_COLORS[task.status],
                )}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60" />
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Priority</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => canManage && updateField({ priority: p })}
                  disabled={!canManage}
                  className={cn(
                    'px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border capitalize',
                    task.priority === p
                      ? `${PRIORITY_COLORS[p]} border-transparent ring-2 ring-offset-1 ring-current`
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700',
                    !canManage && 'cursor-default opacity-80',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Assignee</p>
            {canManage ? (
              <select
                value={task.assignee_id ?? ''}
                onChange={(e) => updateField({ assignee_id: e.target.value || undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {task.assignee_name
                  ? <><Avatar name={task.assignee_name} src={task.assignee_avatar} size="xs" /><span className="text-sm text-gray-700 dark:text-gray-200">{task.assignee_name}</span></>
                  : <span className="text-sm text-gray-400 dark:text-gray-400">Unassigned</span>
                }
              </div>
            )}
          </div>

          {/* Due date */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Due Date</p>
            <DatePicker
              value={task.due_date ?? ''}
              onChange={(v) => canManage && updateField({ due_date: v || undefined })}
              readOnly={!canManage}
              placeholder="Set due date"
            />
          </div>

          {/* Hours */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Hours</p>
            <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
              <div className="text-center">
                <p className="text-[10px] text-gray-400 dark:text-gray-400">Estimated</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {task.estimated_hours ?? '—'}h
                </p>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
              <div className="text-center">
                <p className="text-[10px] text-gray-400 dark:text-gray-400">Logged</p>
                <p className="text-sm font-semibold text-blue-600">
                  {totalLoggedHours}h
                </p>
              </div>
              {task.estimated_hours && (
                <>
                  <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 dark:text-gray-400">Remaining</p>
                    <p className={cn(
                      'text-sm font-semibold',
                      totalLoggedHours > (task.estimated_hours ?? 0) ? 'text-red-600' : 'text-green-600',
                    )}>
                      {Math.max(0, (task.estimated_hours ?? 0) - totalLoggedHours)}h
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Log time */}
          <div>
            {!showLogTime ? (
              <button
                onClick={() => setShowLogTime(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                  border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400
                  hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <Clock size={13} />
                Log Time
              </button>
            ) : (
              <LogTimeForm
                taskId={task.id}
                onSuccess={() => setShowLogTime(false)}
              />
            )}
          </div>

          {/* Time log history */}
          {timeLogs.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Time Log History</p>
              <div className="space-y-2">
                {timeLogs.map((log) => (
                  <div key={log.id} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {log.hours}h
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-400">
                        {formatDate(log.date, 'MMM d')}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{log.user_name}</p>
                    {log.description && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-0.5">{log.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Labels */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {(task.labels ?? []).map((l) => (
                <span key={l} className="flex items-center gap-1 text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400
                  px-2 py-0.5 rounded-full">
                  {l}
                  {canManage && (
                    <button
                      onClick={() => updateField({ labels: (task.labels ?? []).filter((x) => x !== l) } as any)}
                      className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
              {canManage && (
                <input
                  placeholder="+ label"
                  className="text-[11px] w-16 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600
                    text-gray-600 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500
                    focus:outline-none focus:border-blue-400 focus:w-24 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val && !(task.labels ?? []).includes(val)) {
                        updateField({ labels: [...(task.labels ?? []), val] } as any)
                      }
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }}
                />
              )}
            </div>
            {(task.labels ?? []).length === 0 && !canManage && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-1">No labels</p>
            )}
          </div>

          {/* Epic — assign this task to an epic (non-epic tasks only) */}
          {!isEpic && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Epic</p>
              {canManage ? (
                <select
                  value={task.epic_id ?? ''}
                  onChange={(e) => updateField({ epic_id: e.target.value || undefined } as any)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm
                    bg-white dark:bg-gray-900 dark:text-gray-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No epic</option>
                  {projectEpics.map((ep) => (
                    <option key={ep.id} value={ep.id}>{ep.title}</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {task.epic_title ? (
                    <span className="flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400">
                      <Zap size={12} /> {task.epic_title}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">No epic</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Epic children + progress (epic tasks only) */}
          {isEpic && epicProgress && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Epic Progress</p>
              <div className="space-y-2">
                {/* Progress bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-purple-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${epicProgress.progress_pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{epicProgress.done}/{epicProgress.total_children} done</span>
                  <span className="font-semibold text-purple-600">{epicProgress.progress_pct}%</span>
                </div>

                {/* Story points */}
                {epicProgress.total_story_points > 0 && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Story points: {epicProgress.completed_story_points}/{epicProgress.total_story_points}
                  </p>
                )}

                {/* Status breakdown */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(epicProgress.status_breakdown).map(([status, count]) => (
                    <span key={status} className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-medium',
                      STATUS_COLORS[status as TaskStatus] || 'bg-gray-100 text-gray-600',
                    )}>
                      {status.replace(/_/g, ' ')} {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Epic children list */}
          {isEpic && epicChildren.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Child Tasks ({epicChildren.length})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {epicChildren.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-900
                      border border-gray-100 dark:border-gray-700 text-xs"
                  >
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      child.status === 'done' ? 'bg-green-500'
                        : child.status === 'in_progress' ? 'bg-blue-500'
                        : child.status === 'blocked' ? 'bg-red-500'
                        : 'bg-gray-300',
                    )} />
                    <span className={cn(
                      'truncate flex-1',
                      child.status === 'done'
                        ? 'text-gray-400 line-through'
                        : 'text-gray-700 dark:text-gray-200',
                    )}>
                      {child.title}
                    </span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0',
                      PRIORITY_COLORS[child.priority],
                    )}>
                      {child.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEpic && epicChildren.length === 0 && (
            <div className="text-center py-3">
              <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                No tasks linked to this epic yet
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 dark:text-gray-400">
              Created {formatDate(task.created_at, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaskDetailModal
