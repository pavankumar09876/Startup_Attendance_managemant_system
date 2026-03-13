import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, List } from 'lucide-react'

import { projectService } from '@/services/project.service'
import { cn } from '@/utils/cn'
import KanbanBoard from './KanbanBoard'
import MyTasksPage from './MyTasksPage'

type ViewTab = 'my-tasks' | 'kanban'

const TasksPage = () => {
  const [activeTab, setActiveTab]   = useState<ViewTab>('my-tasks')
  const [projectId, setProjectId]   = useState('')

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => projectService.list({ limit: 100 }),
    staleTime: 1000 * 60,
    enabled: activeTab === 'kanban',
  })

  const projects = projectsData?.projects ?? []

  return (
    <div className="space-y-4">
      {/* ── Tab toggle ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('my-tasks')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeTab === 'my-tasks'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <List size={14} />
            My Tasks
          </button>
          <button
            onClick={() => setActiveTab('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              activeTab === 'kanban'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <LayoutGrid size={14} />
            Kanban Board
          </button>
        </div>

        {/* Project selector (kanban tab only) */}
        {activeTab === 'kanban' && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {activeTab === 'my-tasks' ? (
        <MyTasksPage />
      ) : projectId ? (
        <KanbanBoard projectId={projectId} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutGrid size={40} className="text-gray-200 mb-3" />
          <p className="text-gray-500 text-sm font-medium">Select a project above</p>
          <p className="text-gray-400 text-xs mt-1">to view its Kanban board</p>
        </div>
      )}
    </div>
  )
}

export default TasksPage
