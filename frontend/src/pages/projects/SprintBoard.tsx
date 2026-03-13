import { useState } from 'react'
import {
  DndContext, DragOverlay, pointerWithin,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, LayoutList } from 'lucide-react'

import { sprintService } from '@/services/sprint.service'
import { taskService } from '@/services/task.service'
import { projectService } from '@/services/project.service'
import type { Task, TaskStatus } from '@/types/project.types'
import TaskCard from '@/pages/tasks/TaskCard'
import SprintSection from './SprintSection'
import BacklogSection from './BacklogSection'
import CreateSprintModal from './CreateSprintModal'

interface Props {
  projectId: string
  canManage?: boolean
}

const SprintBoard = ({ projectId, canManage = false }: Props) => {
  const [activeTask, setActiveTask]     = useState<Task | null>(null)
  const [createSprintOpen, setCreateSprintOpen] = useState(false)
  const queryClient = useQueryClient()

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintService.list(projectId),
    staleTime: 1000 * 30,
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => taskService.getProjectTasks(projectId),
    staleTime: 1000 * 30,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
  })

  // ── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: updateTask } = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: Partial<Task> }) =>
      taskService.update(taskId, patch),
    onMutate: async ({ taskId, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['project-tasks', projectId] })
      const prev = queryClient.getQueryData<Task[]>(['project-tasks', projectId])
      queryClient.setQueryData<Task[]>(['project-tasks', projectId], (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['project-tasks', projectId], ctx.prev)
      toast.error('Failed to update task')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
  })

  // ── Derived ──────────────────────────────────────────────────────────────────
  const hasActiveSprint = sprints.some((s) => s.status === 'active')

  // Sort: active first, then planned, then completed
  const sortedSprints = [...sprints].sort((a, b) => {
    const order = { active: 0, planned: 1, completed: 2 }
    return order[a.status] - order[b.status]
  })
  const visibleSprints = sortedSprints.filter((s) => s.status !== 'completed')
  const completedSprints = sortedSprints.filter((s) => s.status === 'completed')

  const plannedSprints = sprints.filter((s) => s.status === 'planned')
  const backlogTasks   = tasks.filter((t) => !t.sprint_id)

  const sprintTasks = (sprintId: string) => tasks.filter((t) => t.sprint_id === sprintId)

  // ── DnD ──────────────────────────────────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id)
    setActiveTask(task ?? null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!over || active.id === over.id) return

    const taskId = active.id as string
    const overId = over.id as string

    // Dropped on a backlog section
    if (overId === 'backlog') {
      updateTask({ taskId, patch: { sprint_id: undefined } })
      return
    }

    // Dropped on sprint::status column (e.g. "abc-uuid::in_progress")
    if (overId.includes('::')) {
      const [sprintId, status] = overId.split('::')
      const task = tasks.find((t) => t.id === taskId)
      const patch: Partial<Task> = {}
      if (task?.sprint_id !== sprintId) patch.sprint_id = sprintId
      if (task?.status !== status) patch.status = status as TaskStatus
      if (Object.keys(patch).length > 0) updateTask({ taskId, patch })
      return
    }

    // Dropped on a sprint header (sprint id only — move to sprint, keep status)
    const isSprint = sprints.some((s) => s.id === overId)
    if (isSprint) {
      updateTask({ taskId, patch: { sprint_id: overId } })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (sprintsLoading || tasksLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Toolbar */}
        {canManage && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <LayoutList size={14} />
              <span>{tasks.length} tasks · {sprints.length} sprints</span>
            </div>
            <button
              onClick={() => setCreateSprintOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600
                hover:text-blue-800 transition-colors"
            >
              <Plus size={14} />
              Create Sprint
            </button>
          </div>
        )}

        {/* Active + Planned sprints */}
        {visibleSprints.length === 0 && backlogTasks.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No sprints yet. Create a sprint to get started.
          </div>
        )}

        {visibleSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            plannedSprints={plannedSprints.filter((s) => s.id !== sprint.id)}
            tasks={sprintTasks(sprint.id)}
            canManage={canManage}
            members={members}
            projectId={projectId}
            hasActiveSprint={hasActiveSprint && sprint.status !== 'active'}
          />
        ))}

        {/* Backlog */}
        <BacklogSection
          tasks={backlogTasks}
          sprints={sprints}
          canManage={canManage}
          members={members}
          projectId={projectId}
        />

        {/* Completed sprints (collapsed by default — shown as summary) */}
        {completedSprints.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600
              flex items-center gap-1.5 list-none py-2">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              {completedSprints.length} completed sprint{completedSprints.length > 1 ? 's' : ''}
            </summary>
            <div className="space-y-3 mt-2">
              {completedSprints.map((sprint) => (
                <SprintSection
                  key={sprint.id}
                  sprint={sprint}
                  plannedSprints={[]}
                  tasks={sprintTasks(sprint.id)}
                  canManage={false}
                  members={members}
                  projectId={projectId}
                  hasActiveSprint={false}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 opacity-90 shadow-xl">
            <TaskCard task={activeTask} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>

      {createSprintOpen && (
        <CreateSprintModal
          projectId={projectId}
          onClose={() => setCreateSprintOpen(false)}
        />
      )}
    </DndContext>
  )
}

export default SprintBoard
