import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Edit2, Archive, Plus, CheckCircle2,
  Clock, Flag, Users, DollarSign, BarChart2, X, Search, Layers,
} from 'lucide-react'

import { projectService } from '@/services/project.service'
import { userService } from '@/services/user.service'
import KanbanBoard from '@/pages/tasks/KanbanBoard'
import SprintBoard from './SprintBoard'
import BurndownChart from './BurndownChart'
import type { Task, ProjectMember, TaskStatus, TaskPriority } from '@/types/project.types'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/formatDate'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import EmptyState from '@/components/common/EmptyState'
import DatePicker from '@/components/common/DatePicker'
import { cn } from '@/utils/cn'

// ── Constants ─────────────────────────────────────────────────────────────────
type TabId = 'overview' | 'sprints' | 'tasks' | 'team' | 'budget'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart2 size={14} /> },
  { id: 'sprints',  label: 'Sprints',  icon: <Layers size={14} /> },
  { id: 'tasks',    label: 'Board',    icon: <CheckCircle2 size={14} /> },
  { id: 'team',     label: 'Team',     icon: <Users size={14} /> },
  { id: 'budget',   label: 'Budget',   icon: <DollarSign size={14} /> },
]

const STATUS_COLORS: Record<string, string> = {
  planning:    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  active:      'bg-blue-100 text-blue-700',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold:     'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
  archived:    'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
}

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo:        'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:      'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  medium:   'bg-blue-100 text-blue-600',
  high:     'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

// ── Create/Edit Task Modal ─────────────────────────────────────────────────────
const TaskModal = ({
  projectId,
  task,
  members,
  onClose,
}: {
  projectId: string
  task?: Task | null
  members: ProjectMember[]
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title:          task?.title ?? '',
    description:    task?.description ?? '',
    status:         task?.status ?? 'todo' as TaskStatus,
    priority:       task?.priority ?? 'medium' as TaskPriority,
    assignee_id:    task?.assignee_id ?? '',
    due_date:       task?.due_date ?? '',
    estimated_hours: task?.estimated_hours ?? '',
  })

  const isEdit = !!task

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      isEdit
        ? projectService.updateTask(task!.id, { ...form, estimated_hours: Number(form.estimated_hours) || undefined })
        : projectService.createTask(projectId, { ...form, estimated_hours: Number(form.estimated_hours) || undefined }),
    onSuccess: () => {
      toast.success(isEdit ? 'Task updated' : 'Task created')
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Task' : 'New Task'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Title *</label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Task title…"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(['todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(['low', 'medium', 'high', 'critical'] as TaskPriority[]).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Assignee</label>
            <select
              value={form.assignee_id}
              onChange={(e) => set('assignee_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Due Date</label>
            <DatePicker value={form.due_date} onChange={(v) => set('due_date', v)} placeholder="Select due date" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
            Estimated Hours
          </label>
          <input
            type="number"
            min="0"
            value={form.estimated_hours}
            onChange={(e) => set('estimated_hours', e.target.value)}
            placeholder="e.g. 8"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional task description…"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm resize-none
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            loading={isPending}
            disabled={!form.title.trim()}
            onClick={() => mutate()}
          >
            {isEdit ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add Member Modal ───────────────────────────────────────────────────────────
const AddMemberModal = ({
  projectId,
  existingIds,
  onClose,
}: {
  projectId: string
  existingIds: string[]
  onClose: () => void
}) => {
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [role, setRole]         = useState('contributor')
  const queryClient             = useQueryClient()

  const { data: users = [] } = useQuery({
    queryKey: ['users', 'list', search],
    queryFn: () => userService.list({ search: search || undefined, limit: 20 }),
    select: (d: any) => (Array.isArray(d) ? d : d.users ?? d),
  })

  const filteredUsers = (users as any[]).filter((u) => !existingIds.includes(u.id))

  const { mutate, isPending } = useMutation({
    mutationFn: () => projectService.addMember(projectId, selected!.id, role),
    onSuccess: () => {
      toast.success(`${selected!.name} added to project`)
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  return (
    <Modal open onClose={onClose} title="Add Team Member" size="sm">
      <div className="space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees…"
            className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
              bg-white dark:bg-gray-900 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {filteredUsers.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-40 overflow-y-auto">
            {filteredUsers.map((u: any) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected({ id: u.id, name: u.full_name ?? u.email })}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left',
                  selected?.id === u.id && 'bg-blue-50 dark:bg-blue-900/20',
                )}
              >
                <Avatar name={u.full_name ?? u.email} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {u.full_name ?? u.email}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{u.role}</p>
                </div>
                {selected?.id === u.id && (
                  <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Role in project
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="contributor">Contributor</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!selected}
            loading={isPending}
            onClick={() => mutate()}
          >
            Add Member
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
const OverviewTab = ({ projectId }: { projectId: string }) => {
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.get(projectId),
  })

  const { data: milestones = [] } = useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: () => projectService.getMilestones(projectId),
  })

  if (!project) return null

  return (
    <div className="space-y-6">
      {/* Description */}
      {project.description && (
        <div className="card p-5">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Description</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{project.description}</p>
        </div>
      )}

      {/* Key dates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Start Date',  value: project.start_date ? formatDate(project.start_date, 'MMM d, yyyy') : '—' },
          { label: 'End Date',    value: project.end_date   ? formatDate(project.end_date,   'MMM d, yyyy') : '—' },
          { label: 'Tasks Done',  value: `${project.completed_tasks ?? 0} / ${project.total_tasks ?? 0}` },
          { label: 'Team Size',   value: `${project.member_count ?? project.members?.length ?? 0} members` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</p>
          </div>
        ))}
      </div>

      {/* Burndown chart */}
      {project.start_date && project.end_date && (
        <BurndownChart
          projectId={projectId}
          startDate={project.start_date}
          endDate={project.end_date}
          totalTasks={project.total_tasks ?? 0}
        />
      )}

      {/* Milestones */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Milestones</h4>
        {milestones.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No milestones added yet.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-4">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-start gap-4 pl-9 relative">
                  <div className={cn(
                    'absolute left-2 top-1.5 w-3 h-3 rounded-full border-2',
                    m.status === 'completed' ? 'bg-green-500 border-green-500'
                      : m.status === 'overdue' ? 'bg-red-500 border-red-500'
                        : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{m.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatDate(m.due_date, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge
                    label={m.status}
                    className={
                      m.status === 'completed' ? 'bg-green-100 text-green-700'
                        : m.status === 'overdue' ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────
const TasksTab = ({
  projectId,
  canManage,
}: {
  projectId: string
  canManage: boolean
}) => {
  const [taskModal, setTaskModal] = useState<'create' | Task | null>(null)
  const queryClient               = useQueryClient()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => projectService.listTasks(projectId),
  })

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
  })

  const { mutate: deleteTask } = useMutation({
    mutationFn: (taskId: string) => projectService.deleteTask(taskId),
    onSuccess: () => {
      toast.success('Task deleted')
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
    },
  })

  const grouped = (['todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  }))

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            leftIcon={<Plus size={13} />}
            onClick={() => setTaskModal('create')}
          >
            New Task
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={36} className="text-gray-300" />}
          title="No tasks yet"
          description="Create the first task for this project."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {grouped.map(({ status, tasks: col }) => (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  'text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                  TASK_STATUS_COLORS[status],
                )}>
                  {status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{col.length}</span>
              </div>
              {col.map((task) => (
                <div
                  key={task.id}
                  className="card p-3 cursor-pointer hover:shadow-sm transition-shadow group"
                  onClick={() => canManage && setTaskModal(task)}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">
                      {task.title}
                    </p>
                    {canManage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {task.priority && (
                      <span className={cn(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase',
                        PRIORITY_COLORS[task.priority],
                      )}>
                        {task.priority}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                        <Clock size={9} />
                        {formatDate(task.due_date, 'MMM d')}
                      </span>
                    )}
                    {task.assignee_name && (
                      <div className="ml-auto">
                        <Avatar name={task.assignee_name} size="xs" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {taskModal && (
        <TaskModal
          projectId={projectId}
          task={taskModal === 'create' ? null : taskModal}
          members={members}
          onClose={() => setTaskModal(null)}
        />
      )}
    </div>
  )
}

// ── Team Tab ──────────────────────────────────────────────────────────────────
const TeamTab = ({
  projectId,
  canManage,
}: {
  projectId: string
  canManage: boolean
}) => {
  const [addOpen, setAddOpen] = useState(false)
  const queryClient           = useQueryClient()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (userId: string) => projectService.removeMember(projectId, userId),
    onSuccess: () => {
      toast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
    },
  })

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            leftIcon={<Plus size={13} />}
            onClick={() => setAddOpen(true)}
          >
            Add Member
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users size={36} className="text-gray-300" />}
          title="No team members"
          description="Add members to collaborate on this project."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => (
            <div key={m.id} className="card p-4 flex items-center gap-3 group">
              <Avatar name={m.name} src={m.avatar} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{m.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{m.role_in_project}</p>
                {m.department && (
                  <p className="text-[10px] text-gray-300 dark:text-gray-600">{m.department}</p>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => remove(m.user_id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddMemberModal
          projectId={projectId}
          existingIds={members.map((m) => m.user_id)}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}

// ── Budget Tab ────────────────────────────────────────────────────────────────
const BudgetTab = ({ projectId }: { projectId: string }) => {
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.get(projectId),
  })

  const { data: expenses = [] } = useQuery({
    queryKey: ['project-expenses', projectId],
    queryFn: () => projectService.getExpenses(projectId),
  })

  const budget  = project?.budget ?? 0
  const spent   = project?.spent  ?? 0
  const pct     = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const remaining = budget - spent

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Budget', value: budget > 0 ? fmtCurrency(budget) : '—', color: 'text-gray-900 dark:text-white' },
          { label: 'Spent',        value: spent  > 0 ? fmtCurrency(spent)  : '—', color: 'text-red-600' },
          { label: 'Remaining',    value: budget > 0 ? fmtCurrency(remaining) : '—',
            color: remaining < 0 ? 'text-red-600' : 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Usage bar */}
      {budget > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Budget utilisation</span>
            <span className={cn(
              'font-semibold',
              pct > 90 ? 'text-red-600' : pct > 70 ? 'text-amber-600' : 'text-green-600',
            )}>
              {pct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3">
            <div
              className={cn(
                'h-3 rounded-full transition-all',
                pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Expenses table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Expenses</h4>
        </div>
        {expenses.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={32} className="text-gray-300" />}
            title="No expenses"
            description="No expense records for this project."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {['Date', 'Description', 'Category', 'Amount', 'Submitted By', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(e.date, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-100">{e.description}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{e.category}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {fmtCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{e.submitted_by}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={e.status}
                        className={
                          e.status === 'approved' ? 'bg-green-100 text-green-700'
                            : e.status === 'rejected' ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
const ProjectDetailPage = () => {
  const { id }            = useParams<{ id: string }>()
  const navigate          = useNavigate()
  const { isAdmin, isManager, user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const queryClient       = useQueryClient()

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.get(id!),
    enabled: !!id,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', id],
    queryFn: () => projectService.getMembers(id!),
    enabled: !!id,
  })

  const myProjectRole = members.find((m) => m.user_id === user?.id)?.role_in_project
  const canManage = isAdmin || isManager || myProjectRole === 'owner' || myProjectRole === 'manager'

  const { mutate: archive } = useMutation({
    mutationFn: () => projectService.archive(id!),
    onSuccess: () => {
      toast.success('Project archived')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(ROUTES.PROJECTS)
    },
  })

  const progress = project?.progress ?? 0

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" />
        <div className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" />
      </div>
    )
  }

  if (!project) {
    return (
      <EmptyState
        icon={<Flag size={40} className="text-gray-300" />}
        title="Project not found"
        description="The project you are looking for does not exist."
        action={
          <Button onClick={() => navigate(ROUTES.PROJECTS)}>Back to Projects</Button>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate(ROUTES.PROJECTS)}
              className="mt-0.5 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                <Badge
                  label={project.status.replace(/_/g, ' ')}
                  className={STATUS_COLORS[project.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}
                />
                {project.priority && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">• {project.priority} priority</span>
                )}
              </div>
              {project.client_name && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Client: {project.client_name}</p>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Edit2 size={13} />}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Archive size={13} />}
                onClick={() => archive()}
              >
                Archive
              </Button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="text-gray-500 dark:text-gray-400">Overall progress</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all',
                progress >= 80 ? 'bg-green-500' : progress >= 40 ? 'bg-blue-500' : 'bg-amber-500',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
          {project.manager_name && (
            <div className="flex items-center gap-1.5">
              <Avatar name={project.manager_name} size="xs" />
              <span>{project.manager_name}</span>
            </div>
          )}
          {project.start_date && (
            <span>{formatDate(project.start_date, 'MMM d')} → {project.end_date ? formatDate(project.end_date, 'MMM d, yyyy') : '—'}</span>
          )}
          <span>{project.completed_tasks ?? 0}/{project.total_tasks ?? 0} tasks</span>
          <span>{project.member_count ?? project.members?.length ?? 0} members</span>
          {project.budget && <span>{fmtCurrency(project.budget)} budget</span>}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 px-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      {activeTab === 'overview' && <OverviewTab projectId={id!} />}
      {activeTab === 'sprints'  && <SprintBoard  projectId={id!} canManage={canManage} />}
      {activeTab === 'tasks'    && <KanbanBoard  projectId={id!} canManage={canManage} />}
      {activeTab === 'team'     && <TeamTab      projectId={id!} canManage={canManage} />}
      {activeTab === 'budget'   && <BudgetTab    projectId={id!} />}
    </div>
  )
}

export default ProjectDetailPage
