import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'

import type { Task, TaskStatus } from '@/types/project.types'
import { STATUS_LABEL_MAP, STATUS_HEADER_COLOR_MAP, STATUS_COUNT_COLOR_MAP } from '@/config/taskStatuses'
import { cn } from '@/utils/cn'
import TaskCard from './TaskCard'

interface Props {
  status: TaskStatus
  tasks: Task[]
  onAddTask: (status: TaskStatus) => void
  onTaskClick: (task: Task) => void
  showProject?: boolean
  canManage?: boolean
}

const KanbanColumn = ({ status, tasks, onAddTask, onTaskClick, showProject, canManage }: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const label = STATUS_LABEL_MAP[status]
  const headerColor = STATUS_HEADER_COLOR_MAP[status]
  const countColor = STATUS_COUNT_COLOR_MAP[status]

  return (
    <div className="flex flex-col min-w-[260px] w-[260px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', headerColor)}>
            {label}
          </span>
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', countColor)}>
            {tasks.length}
          </span>
        </div>
        {canManage && (
          <button
            onClick={() => onAddTask(status)}
            className="p-1 rounded-md text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title={`Add task to ${label}`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors',
          isOver ? 'bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-950' : 'bg-gray-100 dark:bg-gray-800',
        )}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            showProject={showProject}
            onClick={() => onTaskClick(task)}
          />
        ))}

        {tasks.length === 0 && (
          <div className={cn(
            'flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-gray-400 dark:text-gray-400 transition-colors',
            isOver ? 'border-blue-300 bg-blue-50 dark:bg-blue-950 text-blue-400' : 'border-gray-200 dark:border-gray-700',
          )}>
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

export default KanbanColumn
