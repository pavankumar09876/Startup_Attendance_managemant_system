import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { taskService } from '@/services/task.service'
import type { Task, Sprint, ProjectMember } from '@/types/project.types'
import { cn } from '@/utils/cn'
import TaskCard from '@/pages/tasks/TaskCard'
import TaskDetailModal from '@/pages/tasks/TaskDetailModal'
import CreateTaskModal from '@/pages/tasks/CreateTaskModal'

interface Props {
  tasks: Task[]
  sprints: Sprint[]
  canManage: boolean
  members: ProjectMember[]
  projectId: string
  selectedIds?: Set<string>
  onToggleSelect?: (taskId: string, e: React.MouseEvent) => void
}

const BacklogSection = ({ tasks, sprints, canManage, members, projectId, selectedIds = new Set(), onToggleSelect }: Props) => {
  const [collapsed, setCollapsed]       = useState(false)
  const [detailTask, setDetailTask]     = useState<Task | null>(null)
  const [createOpen, setCreateOpen]     = useState(false)
  const queryClient = useQueryClient()

  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })

  const { mutate: moveToSprint } = useMutation({
    mutationFn: ({ taskId, sprintId }: { taskId: string; sprintId: string | null }) =>
      taskService.update(taskId, { sprint_id: sprintId ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
    },
    onError: () => toast.error('Failed to move task'),
  })

  const plannedOrActive = sprints.filter((s) => s.status === 'planned' || s.status === 'active')

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Backlog</span>
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
        {canManage && (
          <button
            onClick={(e) => { e.stopPropagation(); setCreateOpen(true) }}
            className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus size={12} /> Add task
          </button>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div
          ref={setNodeRef}
          className={cn(
            'px-4 pb-4 min-h-[60px] transition-all duration-200 rounded-b-xl',
            isOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-300 scale-[1.005]' : '',
          )}
        >
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              Drag tasks here to move them to the backlog
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="group flex items-start gap-2">
                  <div
                    className={cn(
                      'flex-1 rounded-lg transition-all duration-150',
                      selectedIds.has(task.id) && 'ring-2 ring-blue-400 ring-offset-1',
                    )}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) {
                        onToggleSelect?.(task.id, e)
                      } else {
                        setDetailTask(task)
                      }
                    }}
                  >
                    <TaskCard
                      task={task}
                      onClick={() => {}}
                    />
                  </div>
                  {canManage && plannedOrActive.length > 0 && (
                    <select
                      className="shrink-0 text-xs border border-gray-200 dark:border-gray-700 rounded-md px-1.5 py-1
                        text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity
                        focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-900 mt-1"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) moveToSprint({ taskId: task.id, sprintId: e.target.value })
                        e.target.value = ''
                      }}
                      title="Move to sprint"
                    >
                      <option value="" disabled>Move to…</option>
                      {plannedOrActive.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {createOpen && (
        <CreateTaskModal
          projectId={projectId}
          defaultStatus="todo"
          onClose={() => setCreateOpen(false)}
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

export default BacklogSection
