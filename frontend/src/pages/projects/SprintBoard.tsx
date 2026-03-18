import { useState, useCallback } from 'react'
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
import { cn } from '@/utils/cn'

interface Props {
  projectId: string
  canManage?: boolean
}

const SprintBoard = ({ projectId, canManage = false }: Props) => {
  const [activeTask, setActiveTask]     = useState<Task | null>(null)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
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
      queryClient.invalidateQueries({ queryKey: ['sprint-workload'] })
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

  // ── Multi-select ────────────────────────────────────────────────────────────
  const toggleSelect = useCallback((taskId: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(taskId)) next.delete(taskId)
        else next.add(taskId)
        return next
      })
    } else if (e.shiftKey && selectedIds.size > 0) {
      // Range select: select all tasks between last selected and clicked
      const lastSelected = [...selectedIds].pop()!
      const allTaskIds = tasks.map((t) => t.id)
      const startIdx = allTaskIds.indexOf(lastSelected)
      const endIdx = allTaskIds.indexOf(taskId)
      if (startIdx !== -1 && endIdx !== -1) {
        const [lo, hi] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
        setSelectedIds((prev) => {
          const next = new Set(prev)
          for (let i = lo; i <= hi; i++) next.add(allTaskIds[i])
          return next
        })
      }
    }
  }, [selectedIds, tasks])

  // ── DnD ──────────────────────────────────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id)
    setActiveTask(task ?? null)
    // If dragging an unselected task, clear multi-selection
    if (!selectedIds.has(active.id as string)) {
      setSelectedIds(new Set())
    }
  }

  const buildPatch = (overId: string, taskId: string): Partial<Task> | null => {
    if (overId === 'backlog') return { sprint_id: undefined }
    if (overId.includes('::')) {
      const [sprintId, status] = overId.split('::')
      const task = tasks.find((t) => t.id === taskId)
      const patch: Partial<Task> = {}
      if (task?.sprint_id !== sprintId) patch.sprint_id = sprintId
      if (task?.status !== status) patch.status = status as TaskStatus
      return Object.keys(patch).length > 0 ? patch : null
    }
    const isSprint = sprints.some((s) => s.id === overId)
    if (isSprint) return { sprint_id: overId }
    return null
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null)
    if (!over || active.id === over.id) return

    const overId = over.id as string
    const draggedId = active.id as string

    // If multi-selected, move all selected tasks
    const idsToMove = selectedIds.size > 0 && selectedIds.has(draggedId)
      ? [...selectedIds]
      : [draggedId]

    for (const taskId of idsToMove) {
      const patch = buildPatch(overId, taskId)
      if (patch) updateTask({ taskId, patch })
    }

    setSelectedIds(new Set())
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (sprintsLoading || tasksLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
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
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
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
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
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
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ))}

        {/* Backlog */}
        <BacklogSection
          tasks={backlogTasks}
          sprints={sprints}
          canManage={canManage}
          members={members}
          projectId={projectId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />

        {/* Completed sprints (collapsed by default — shown as summary) */}
        {completedSprints.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300
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
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeTask && (
          <div className={cn(
            'rotate-2 shadow-xl transition-transform',
            selectedIds.size > 1 ? 'opacity-95' : 'opacity-90',
          )}>
            <TaskCard task={activeTask} onClick={() => {}} />
            {selectedIds.size > 1 && (
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600
                text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
                {selectedIds.size}
              </div>
            )}
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
