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
}

const BacklogSection = ({ tasks, sprints, canManage, members, projectId }: Props) => {
  const [collapsed, setCollapsed]       = useState(false)
  const [detailTask, setDetailTask]     = useState<Task | null>(null)
  const [createOpen, setCreateOpen]     = useState(false)
  const queryClient = useQueryClient()

  const { setNodeRef, isOver } = useDroppable({ id: 'backlog' })

  const { mutate: moveToSprint } = useMutation({
    mutationFn: ({ taskId, sprintId }: { taskId: string; sprintId: string | null }) =>
      taskService.update(taskId, { sprint_id: sprintId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
    },
    onError: () => toast.error('Failed to move task'),
  })

  const plannedOrActive = sprints.filter((s) => s.status === 'planned' || s.status === 'active')

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <button className="text-gray-400 hover:text-gray-600 shrink-0">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className="text-sm font-semibold text-gray-700">Backlog</span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
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
            'px-4 pb-4 min-h-[60px] transition-colors rounded-b-xl',
            isOver ? 'bg-blue-50' : '',
          )}
        >
          {tasks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
              Drag tasks here to move them to the backlog
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="group flex items-start gap-2">
                  <div className="flex-1">
                    <TaskCard
                      task={task}
                      onClick={() => setDetailTask(task)}
                    />
                  </div>
                  {canManage && plannedOrActive.length > 0 && (
                    <select
                      className="shrink-0 text-xs border border-gray-200 rounded-md px-1.5 py-1
                        text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity
                        focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white mt-1"
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
