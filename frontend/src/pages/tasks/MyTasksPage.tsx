import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Filter, X, Bookmark, Plus, Star, Trash2 } from 'lucide-react'

import { taskService } from '@/services/task.service'
import type { Task, TaskStatus, TaskPriority, SavedTaskView } from '@/types/project.types'
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
  todo:        'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:      'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
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
  const queryClient = useQueryClient()

  const [dueFilter, setDueFilter]       = useState<DueFilter>('all')
  const [priorityFilter, setPriority]   = useState('')
  const [statusFilter, setStatus]       = useState('')
  const [projectFilter, setProject]     = useState('')
  const [search, setSearch]             = useState('')
  const [labelFilter, setLabel]         = useState('')
  const [issueTypeFilter, setIssueType] = useState('')
  const [dueDateFrom, setDueDateFrom]   = useState('')
  const [dueDateTo, setDueDateTo]       = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Saved views
  const [activeViewId, setActiveViewId]     = useState<string | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newViewName, setNewViewName]       = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const hasAdvancedFilters = !!(labelFilter || issueTypeFilter || dueDateFrom || dueDateTo)
  const hasAnyFilter = !!(
    dueFilter !== 'all' || priorityFilter || statusFilter || search ||
    labelFilter || issueTypeFilter || dueDateFrom || dueDateTo
  )

  // ── Saved views query ─────────────────────────────────────────────────────
  const { data: savedViews = [] } = useQuery({
    queryKey: ['tasks', 'saved-views'],
    queryFn: () => taskService.getSavedViews(),
    staleTime: 1000 * 60,
  })

  const createViewMutation = useMutation({
    mutationFn: taskService.createSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'saved-views'] })
      setShowSaveDialog(false)
      setNewViewName('')
    },
  })

  const deleteViewMutation = useMutation({
    mutationFn: taskService.deleteSavedView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'saved-views'] })
      setActiveViewId(null)
    },
  })

  // ── Filter helpers ────────────────────────────────────────────────────────
  const getCurrentFilters = (): Record<string, string | undefined> => ({
    due:        dueFilter !== 'all' ? dueFilter : undefined,
    priority:   priorityFilter || undefined,
    status:     statusFilter   || undefined,
    search:     search         || undefined,
    label:      labelFilter    || undefined,
    issue_type: issueTypeFilter || undefined,
    due_from:   dueDateFrom    || undefined,
    due_to:     dueDateTo      || undefined,
  })

  const applyView = (view: SavedTaskView) => {
    const f = view.filters
    setDueFilter((f.due as DueFilter) || 'all')
    setPriority(f.priority || '')
    setStatus(f.status || '')
    setSearch(f.search || '')
    setLabel(f.label || '')
    setIssueType(f.issue_type || '')
    setDueDateFrom(f.due_from || '')
    setDueDateTo(f.due_to || '')
    setActiveViewId(view.id)
    // Open advanced panel if the view uses advanced filters
    if (f.label || f.due_from || f.due_to) {
      setShowAdvanced(true)
    }
  }

  const clearAllFilters = () => {
    setDueFilter('all')
    setPriority('')
    setStatus('')
    setSearch('')
    setLabel('')
    setIssueType('')
    setDueDateFrom('')
    setDueDateTo('')
    setActiveViewId(null)
  }

  const saveCurrentView = () => {
    if (!newViewName.trim()) return
    createViewMutation.mutate({
      name: newViewName.trim(),
      filters: getCurrentFilters(),
    })
  }

  // ── Tasks query ───────────────────────────────────────────────────────────
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: [
      'tasks', 'my', dueFilter, priorityFilter, statusFilter, projectFilter,
      debouncedSearch, labelFilter, issueTypeFilter, dueDateFrom, dueDateTo,
    ],
    queryFn: () =>
      taskService.getMyTasks({
        due:        dueFilter !== 'all' ? dueFilter : undefined,
        priority:   priorityFilter || undefined,
        status:     statusFilter   || undefined,
        project_id: projectFilter  || undefined,
        search:     debouncedSearch || undefined,
        label:      labelFilter    || undefined,
        issue_type: issueTypeFilter || undefined,
        due_from:   dueDateFrom    || undefined,
        due_to:     dueDateTo      || undefined,
        limit: 100,
      }),
    staleTime: 1000 * 30,
  })

  const overdueCount = tasks.filter(isOverdueRow).length

  return (
    <div className="space-y-4">
      {/* ── Saved views bar ──────────────────────────────────── */}
      {savedViews.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Bookmark size={14} className="text-gray-400" />
          {savedViews.map((view) => (
            <div key={view.id} className="group flex items-center gap-0">
              <button
                onClick={() => applyView(view)}
                className={cn(
                  'px-3 py-1.5 rounded-l-lg text-xs font-medium transition-all border',
                  activeViewId === view.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                {view.is_default && <Star size={10} className="inline mr-1 text-amber-500" />}
                {view.name}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteViewMutation.mutate(view.id)
                }}
                className={cn(
                  'px-1.5 py-1.5 rounded-r-lg text-xs border border-l-0 transition-all',
                  'opacity-0 group-hover:opacity-100',
                  activeViewId === view.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-red-400 hover:text-red-600'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-red-300 hover:text-red-500',
                )}
                title="Delete view"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Due filter tabs ──────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {DUE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setDueFilter(tab.id); setActiveViewId(null) }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              dueFilter === tab.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
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
          onChange={(e) => { setSearch(e.target.value); setActiveViewId(null) }}
          placeholder="Search tasks..."
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        />

        <select
          value={priorityFilter}
          onChange={(e) => { setPriority(e.target.value); setActiveViewId(null) }}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-white
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
          onChange={(e) => { setStatus(e.target.value); setActiveViewId(null) }}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>

        <select
          value={issueTypeFilter}
          onChange={(e) => { setIssueType(e.target.value); setActiveViewId(null) }}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="task">Task</option>
          <option value="bug">Bug</option>
          <option value="story">Story</option>
          <option value="epic">Epic</option>
        </select>

        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors',
            showAdvanced || hasAdvancedFilters
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400',
          )}
        >
          <Filter size={14} />
          More
          {hasAdvancedFilters && (
            <span className="bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {[labelFilter, dueDateFrom, dueDateTo].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Save current filters as view */}
        {hasAnyFilter && !showSaveDialog && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed
              border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400
              hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            <Plus size={14} />
            Save view
          </button>
        )}

        {/* Save dialog inline */}
        {showSaveDialog && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCurrentView()}
              placeholder="View name..."
              autoFocus
              className="px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
            <button
              onClick={saveCurrentView}
              disabled={!newViewName.trim() || createViewMutation.isPending}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium
                hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createViewMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setShowSaveDialog(false); setNewViewName('') }}
              className="p-1.5 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {hasAnyFilter && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
          >
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {/* ── Advanced filters (collapsible) ──────────────────── */}
      {showAdvanced && (
        <div className="flex items-center gap-3 flex-wrap p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Label</label>
            <input
              type="text"
              value={labelFilter}
              onChange={(e) => { setLabel(e.target.value); setActiveViewId(null) }}
              placeholder="e.g. bug, frontend"
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Due From</label>
            <input
              type="date"
              value={dueDateFrom}
              onChange={(e) => { setDueDateFrom(e.target.value); setActiveViewId(null) }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Due To</label>
            <input
              type="date"
              value={dueDateTo}
              onChange={(e) => { setDueDateTo(e.target.value); setActiveViewId(null) }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
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
              <thead className="bg-gray-50 dark:bg-gray-800">
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
                      className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {tasks.map((task) => {
                  const overdue = isOverdueRow(task)
                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
                        overdue && 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30',
                      )}
                    >
                      {/* Task title */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{task.title}</p>
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {task.labels.slice(0, 2).map((l) => (
                              <span key={l} className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 rounded-full">
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
                          <span className="text-gray-400 dark:text-gray-500">—</span>
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
                            overdue ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-gray-300',
                          )}>
                            {formatDate(task.due_date, 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>

                      {/* Logged hours */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        <span className="text-sm">
                          {task.logged_hours != null ? `${task.logged_hours}h` : '—'}
                        </span>
                        {task.estimated_hours && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
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
                              <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[80px]">
                                {task.assignee_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">Unassigned</span>
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
