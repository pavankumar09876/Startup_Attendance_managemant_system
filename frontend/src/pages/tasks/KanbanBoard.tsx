import { useState, useMemo } from 'react'
import {
  DndContext, DragOverlay, pointerWithin,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { taskService } from '@/services/task.service'
import { projectService } from '@/services/project.service'
import type { Task, TaskStatus, ProjectMember } from '@/types/project.types'
import { ALL_STATUS_KEYS } from '@/config/taskStatuses'
import { cn } from '@/utils/cn'
import KanbanColumn from './KanbanColumn'
import TaskCard from './TaskCard'
import CreateTaskModal from './CreateTaskModal'
import TaskDetailModal from './TaskDetailModal'

const STATUSES = ALL_STATUS_KEYS

interface Props {
  projectId: string
  canManage?: boolean
}

const KanbanBoard = ({ projectId, canManage = false }: Props) => {
  const [activeTask, setActiveTask]   = useState<Task | null>(null)
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null)
  const [detailTask, setDetailTask]   = useState<Task | null>(null)
  const queryClient = useQueryClient()

  const queryKey = ['project-tasks', projectId]

  const { data: tasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => taskService.getProjectTasks(projectId),
    staleTime: 1000 * 30,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      taskService.updateStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey })
      const prev = queryClient.getQueryData<Task[]>(queryKey)
      queryClient.setQueryData<Task[]>(queryKey, (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, status: status as TaskStatus } : t)),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev)
      toast.error('Failed to update task status')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const grouped = useMemo(
    () =>
      STATUSES.reduce(
        (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s) }),
        {} as Record<TaskStatus, Task[]>,
      ),
    [tasks],
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!over) return

    // over.id is either a column status or another task's id
    const targetStatus = STATUSES.includes(over.id as TaskStatus)
      ? (over.id as TaskStatus)
      : tasks.find((t) => t.id === over.id)?.status

    if (!targetStatus) return

    const draggedTask = tasks.find((t) => t.id === active.id)
    if (!draggedTask || draggedTask.status === targetStatus) return

    updateStatus({ taskId: draggedTask.id, status: targetStatus })
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {STATUSES.map((s) => (
          <div key={s} className="min-w-[260px] space-y-2">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Board */}
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-3">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={grouped[status] ?? []}
              onAddTask={(s) => setCreateStatus(s)}
              onTaskClick={(t) => setDetailTask(t)}
              canManage={canManage}
            />
          ))}
        </div>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay>
          {activeTask && (
            <div className={cn(
              'w-[260px] opacity-90 rotate-1 shadow-xl',
            )}>
              <TaskCard
                task={activeTask}
                onClick={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Create task modal */}
      {createStatus !== null && (
        <CreateTaskModal
          projectId={projectId}
          defaultStatus={createStatus}
          members={members}
          onClose={() => setCreateStatus(null)}
        />
      )}

      {/* Task detail modal */}
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

export default KanbanBoard
