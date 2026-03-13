import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ChevronDown, ChevronRight, Play, CheckCircle2, Zap, Calendar, Target,
} from 'lucide-react'
import { sprintService } from '@/services/sprint.service'
import type { Sprint, Task, TaskStatus, ProjectMember } from '@/types/project.types'
import { cn } from '@/utils/cn'
import TaskCard from '@/pages/tasks/TaskCard'
import TaskDetailModal from '@/pages/tasks/TaskDetailModal'
import CreateTaskModal from '@/pages/tasks/CreateTaskModal'
import CompleteSprintModal from './CompleteSprintModal'
import { formatDate } from '@/utils/formatDate'

const STATUS_COLS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done']

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  in_review:   'In Review',
  done:        'Done',
  blocked:     'Blocked',
}

const STATUS_COLORS: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
}

// ── Droppable column within a sprint ─────────────────────────────────────────
const SprintColumn = ({
  sprintId,
  status,
  tasks,
  canManage,
  members,
  projectId,
  onOpenTask,
}: {
  sprintId: string
  status: TaskStatus
  tasks: Task[]
  canManage: boolean
  members: ProjectMember[]
  projectId: string
  onOpenTask: (t: Task) => void
}) => {
  const droppableId = `${sprintId}::${status}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 min-w-[200px] rounded-xl p-3 transition-colors',
        isOver ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50',
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full', STATUS_COLORS[status])}>
          {STATUS_LABELS[status]}
        </span>
        <span className="text-xs text-gray-400">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onOpenTask(task)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Sprint Section ─────────────────────────────────────────────────────────────
interface Props {
  sprint: Sprint
  plannedSprints: Sprint[]
  tasks: Task[]
  canManage: boolean
  members: ProjectMember[]
  projectId: string
  hasActiveSprint: boolean
}

const SprintSection = ({
  sprint,
  plannedSprints,
  tasks,
  canManage,
  members,
  projectId,
  hasActiveSprint,
}: Props) => {
  const [collapsed, setCollapsed]         = useState(false)
  const [completeOpen, setCompleteOpen]   = useState(false)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [detailTask, setDetailTask]       = useState<Task | null>(null)
  const queryClient = useQueryClient()

  const { mutate: startSprint, isPending: starting } = useMutation({
    mutationFn: () => sprintService.start(sprint.id),
    onSuccess: () => {
      toast.success(`Sprint "${sprint.name}" started`)
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to start sprint'),
  })

  const { mutate: deleteSprint } = useMutation({
    mutationFn: () => sprintService.remove(sprint.id),
    onSuccess: () => {
      toast.success('Sprint deleted')
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to delete sprint'),
  })

  const isActive    = sprint.status === 'active'
  const isPlanned   = sprint.status === 'planned'
  const isCompleted = sprint.status === 'completed'

  const pct = sprint.completion_pct
  const storyPtsUsed = sprint.completed_story_points
  const storyPtsTotal = sprint.total_story_points

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden',
      isActive    ? 'border-blue-300 bg-white shadow-sm'
        : isCompleted ? 'border-gray-200 bg-gray-50 opacity-80'
          : 'border-gray-200 bg-white',
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <button className="text-gray-400 hover:text-gray-600 shrink-0">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{sprint.name}</span>
            {isActive && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Active
              </span>
            )}
            {isCompleted && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                Completed
              </span>
            )}
            {sprint.goal && (
              <span className="text-xs text-gray-400 italic truncate max-w-xs">{sprint.goal}</span>
            )}
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Target size={10} />
              {sprint.completed_tasks}/{sprint.total_tasks} tasks
            </span>
            {storyPtsTotal > 0 && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Zap size={10} />
                {storyPtsUsed}/{storyPtsTotal} pts
                {sprint.capacity && ` (cap: ${sprint.capacity})`}
              </span>
            )}
            {sprint.days_remaining !== undefined && sprint.days_remaining !== null && (
              <span className={cn('text-xs flex items-center gap-1',
                sprint.days_remaining <= 2 ? 'text-red-500' : 'text-gray-500',
              )}>
                <Calendar size={10} />
                {sprint.days_remaining}d left
              </span>
            )}
            {sprint.burn_rate !== undefined && sprint.burn_rate !== null && (
              <span className="text-xs text-gray-500">
                {sprint.burn_rate} pts/day
              </span>
            )}
            {sprint.velocity !== undefined && sprint.velocity !== null && (
              <span className="text-xs text-green-600">
                Velocity: {sprint.velocity} pts
              </span>
            )}
            {sprint.start_date && (
              <span className="text-xs text-gray-400">
                {formatDate(sprint.start_date, 'MMM d')}
                {sprint.end_date && ` – ${formatDate(sprint.end_date, 'MMM d')}`}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-24 hidden sm:block">
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all',
                pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-amber-500',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        {canManage && !isCompleted && (
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isPlanned && (
              <button
                onClick={() => startSprint()}
                disabled={starting || hasActiveSprint}
                title={hasActiveSprint ? 'Another sprint is already active' : 'Start sprint'}
                className={cn(
                  'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors',
                  hasActiveSprint
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700',
                )}
              >
                <Play size={11} />
                Start
              </button>
            )}
            {isActive && (
              <button
                onClick={() => setCompleteOpen(true)}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg
                  bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 size={11} />
                Complete
              </button>
            )}
            {isPlanned && (
              <button
                onClick={() => deleteSprint()}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
              >
                Delete
              </button>
            )}
            {(isActive || isPlanned) && (
              <button
                onClick={() => setCreateTaskOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
              >
                + Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              No tasks in this sprint. Drag tasks here or create new ones.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {STATUS_COLS.map((status) => (
                <SprintColumn
                  key={status}
                  sprintId={sprint.id}
                  status={status}
                  tasks={tasks.filter((t) => t.status === status)}
                  canManage={canManage}
                  members={members}
                  projectId={projectId}
                  onOpenTask={setDetailTask}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {completeOpen && (
        <CompleteSprintModal
          sprint={sprint}
          plannedSprints={plannedSprints}
          projectId={projectId}
          onClose={() => setCompleteOpen(false)}
        />
      )}

      {createTaskOpen && (
        <CreateTaskModal
          projectId={projectId}
          sprintId={sprint.id}
          defaultStatus="todo"
          onClose={() => setCreateTaskOpen(false)}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          members={members}
          canManage={canManage}
          onClose={() => setDetailTask(null)}
        />
      )}
    </div>
  )
}

export default SprintSection
