import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckSquare } from 'lucide-react'

import { taskService } from '@/services/task.service'
import type { Task, TaskStatus, TaskPriority } from '@/types/project.types'
import { formatDate } from '@/utils/formatDate'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'

// ── Constants ─────────────────────────────────────────────────────────────────
type DueFilter = 'all' | 'today' | 'week' | 'overdue' | 'completed'

const DUE_TABS: { id: DueFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'today',     label: 'Today' },
  { id: 'week',      label: 'This Week' },
  { id: 'overdue',   label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
]

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:      'bg-gray-100 text-gray-500',
  medium:   'bg-blue-100 text-blue-600',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const isOverdueRow = (task: Task) =>
  task.due_date &&
  task.status !== 'done' &&
  new Date(task.due_date) < new Date()

// ── Component ─────────────────────────────────────────────────────────────────
const MyTasksPage = () => {
  const { isManager, isAdmin } = useAuth()
  const [dueFilter, setDueFilter]     = useState<DueFilter>('all')
  const [priorityFilter, setPriority] = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [projectFilter, setProject]   = useState('')
  const [search, setSearch]           = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'my', dueFilter, priorityFilter, statusFilter, projectFilter, debouncedSearch],
    queryFn: () =>
      taskService.getMyTasks({
        due:        dueFilter !== 'all' ? dueFilter : undefined,
        priority:   priorityFilter || undefined,
        status:     statusFilter   || undefined,
        project_id: projectFilter  || undefined,
        search:     debouncedSearch || undefined,
        limit: 100,
      }),
    staleTime: 1000 * 30,
  })

  const overdueCount = tasks.filter(isOverdueRow).length

  return (
    <div className="space-y-4">
      {/* ── Due filter tabs ──────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {DUE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDueFilter(tab.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              dueFilter === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
            {tab.id === 'overdue' && overdueCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                {overdueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filter row ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        />

        <select
          value={priorityFilter}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare size={40} className="text-gray-300" />}
            title="No tasks found"
            description={
              dueFilter !== 'all'
                ? `No ${DUE_TABS.find((t) => t.id === dueFilter)?.label.toLowerCase()} tasks.`
                : 'You have no tasks assigned yet.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Task',
                    'Project',
                    'Priority',
                    'Status',
                    'Due Date',
                    'Logged',
                    ...(isAdmin || isManager ? ['Assignee'] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((task) => {
                  const overdue = isOverdueRow(task)
                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        'transition-colors hover:bg-gray-50',
                        overdue && 'bg-red-50 hover:bg-red-100',
                      )}
                    >
                      {/* Task title */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="font-medium text-gray-800 truncate">{task.title}</p>
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {task.labels.slice(0, 2).map((l) => (
                              <span key={l} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 rounded-full">
                                {l}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Project */}
                      <td className="px-4 py-3">
                        {task.project_name ? (
                          <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            {task.project_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <Badge
                          label={task.priority}
                          className={PRIORITY_COLORS[task.priority]}
                        />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge
                          label={task.status.replace(/_/g, ' ')}
                          className={STATUS_COLORS[task.status]}
                        />
                      </td>

                      {/* Due date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {task.due_date ? (
                          <span className={cn(
                            'text-sm',
                            overdue ? 'text-red-600 font-semibold' : 'text-gray-600',
                          )}>
                            {formatDate(task.due_date, 'MMM d, yyyy')}
                            {overdue && ' ⚠'}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Logged hours */}
                      <td className="px-4 py-3 text-gray-600">
                        <span className="text-sm">
                          {task.logged_hours != null ? `${task.logged_hours}h` : '—'}
                        </span>
                        {task.estimated_hours && (
                          <span className="text-xs text-gray-400">
                            /{task.estimated_hours}h
                          </span>
                        )}
                      </td>

                      {/* Assignee (manager/admin) */}
                      {(isAdmin || isManager) && (
                        <td className="px-4 py-3">
                          {task.assignee_name ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar
                                name={task.assignee_name}
                                src={task.assignee_avatar}
                                size="xs"
                              />
                              <span className="text-xs text-gray-600 truncate max-w-[80px]">
                                {task.assignee_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Unassigned</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyTasksPage
