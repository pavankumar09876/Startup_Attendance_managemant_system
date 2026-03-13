import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'

import type { Task, TaskStatus } from '@/types/project.types'
import { cn } from '@/utils/cn'
import TaskCard from './TaskCard'

// ── Column config ─────────────────────────────────────────────────────────────
export const COLUMN_CONFIG: Record<TaskStatus, { label: string; headerColor: string; countColor: string }> = {
  todo:        { label: 'Todo',        headerColor: 'text-gray-700',   countColor: 'bg-gray-200 text-gray-600' },
  in_progress: { label: 'In Progress', headerColor: 'text-blue-700',   countColor: 'bg-blue-100 text-blue-700' },
  in_review:   { label: 'In Review',   headerColor: 'text-purple-700', countColor: 'bg-purple-100 text-purple-700' },
  done:        { label: 'Done',        headerColor: 'text-green-700',  countColor: 'bg-green-100 text-green-700' },
  blocked:     { label: 'Blocked',     headerColor: 'text-red-700',    countColor: 'bg-red-100 text-red-700' },
}

interface Props {
  status: TaskStatus
  tasks: Task[]
  onAddTask: (status: TaskStatus) => void
  onTaskClick: (task: Task) => void
  showProject?: boolean
}

const KanbanColumn = ({ status, tasks, onAddTask, onTaskClick, showProject }: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const config = COLUMN_CONFIG[status]

  return (
    <div className="flex flex-col min-w-[260px] w-[260px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', config.headerColor)}>
            {config.label}
          </span>
          <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', config.countColor)}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(status)}
          className="p-1 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
          title={`Add task to ${config.label}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors',
          isOver ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-gray-100',
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
            'flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-gray-400 transition-colors',
            isOver ? 'border-blue-300 bg-blue-50 text-blue-400' : 'border-gray-200',
          )}>
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

export default KanbanColumn
