import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Clock, CheckSquare, Tag } from 'lucide-react'

import type { Task, TaskPriority } from '@/types/project.types'
import { formatDate } from '@/utils/formatDate'
import Avatar from '@/components/common/Avatar'
import { cn } from '@/utils/cn'

// ── Priority left-border color ─────────────────────────────────────────────
const PRIORITY_BORDER: Record<TaskPriority, string> = {
  critical: 'border-l-red-500',
  high:     'border-l-orange-400',
  medium:   'border-l-blue-400',
  low:      'border-l-gray-300',
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-blue-400',
  low:      'bg-gray-300',
}

interface Props {
  task: Task
  showProject?: boolean
  onClick: () => void
}

const TaskCard = ({ task, showProject = false, onClick }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const isOverdue =
    task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'bg-white rounded-lg border border-l-4 p-3 cursor-pointer select-none',
        'hover:shadow-md transition-all',
        PRIORITY_BORDER[task.priority],
        isDragging && 'opacity-50 scale-105 shadow-lg ring-2 ring-blue-300 z-50',
      )}
    >
      {/* Title */}
      <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2 leading-snug">
        {task.title}
      </p>

      {/* Project pill (global my-tasks view) */}
      {showProject && task.project_name && (
        <span className="inline-block mb-2 text-[10px] font-medium bg-purple-50 text-purple-600
          px-1.5 py-0.5 rounded-full truncate max-w-full">
          {task.project_name}
        </span>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((l) => (
            <span key={l} className="flex items-center gap-0.5 text-[10px] bg-gray-100
              text-gray-600 px-1.5 py-0.5 rounded-full">
              <Tag size={8} />
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          {/* Priority dot */}
          <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[task.priority])} />

          {/* Due date */}
          {task.due_date && (
            <span className={cn(
              'flex items-center gap-0.5',
              isOverdue ? 'text-red-500 font-medium' : 'text-gray-400',
            )}>
              <Clock size={10} />
              {formatDate(task.due_date, 'MMM d')}
            </span>
          )}

          {/* Subtask progress */}
          {(task.subtask_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-gray-400">
              <CheckSquare size={10} />
              {task.completed_subtasks ?? 0}/{task.subtask_count}
            </span>
          )}
        </div>

        {/* Assignee avatar */}
        {task.assignee_name && (
          <Avatar
            name={task.assignee_name}
            src={task.assignee_avatar}
            size="xs"
          />
        )}
      </div>
    </div>
  )
}

export default TaskCard
