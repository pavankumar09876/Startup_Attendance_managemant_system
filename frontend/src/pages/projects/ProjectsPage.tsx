import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, LayoutGrid, List, Archive,
  Calendar, Users, CheckSquare, TrendingUp,
} from 'lucide-react'

import { projectService } from '@/services/project.service'
import type { Project, ProjectStatus } from '@/types/project.types'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/formatDate'
import { useDebounce } from '@/hooks/useDebounce'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'
import CreateProjectModal from './CreateProjectModal'

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_TABS: { id: ProjectStatus | 'all'; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'active',     label: 'Active' },
  { id: 'planning',   label: 'Planning' },
  { id: 'on_hold',    label: 'On Hold' },
  { id: 'completed',  label: 'Completed' },
]

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning:    'bg-gray-100 text-gray-600',
  active:      'bg-blue-100 text-blue-700',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold:     'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
  archived:    'bg-gray-100 text-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:      'bg-gray-100 text-gray-500',
  medium:   'bg-blue-100 text-blue-600',
  high:     'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const daysLeft = (deadline?: string): number | null => {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
  return diff
}

const progressColor = (pct: number) => {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 40) return 'bg-blue-500'
  return 'bg-amber-500'
}

// ── Project Card (grid view) ───────────────────────────────────────────────────
const ProjectCard = ({
  project,
  onClick,
}: {
  project: Project
  onClick: () => void
}) => {
  const progress  = project.progress ?? 0
  const days      = daysLeft(project.end_date)
  const budgetPct = project.budget && project.spent != null
    ? Math.min((project.spent / project.budget) * 100, 100)
    : null

  return (
    <div
      onClick={onClick}
      className="card p-5 cursor-pointer hover:shadow-md transition-shadow group"
    >
      {/* Top row: priority + status */}
      <div className="flex items-start justify-between mb-3">
        {project.priority && (
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
            PRIORITY_COLORS[project.priority] ?? 'bg-gray-100 text-gray-500',
          )}>
            {project.priority}
          </span>
        )}
        <Badge
          label={project.status.replace(/_/g, ' ')}
          className={STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-600'}
        />
      </div>

      {/* Name */}
      <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-0.5 truncate">
        {project.name}
      </h3>

      {/* Client */}
      {project.client_name && (
        <p className="text-xs text-gray-400 mb-3 truncate">{project.client_name}</p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-semibold text-gray-700">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={cn('h-1.5 rounded-full transition-all', progressColor(progress))}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-1">
          <CheckSquare size={12} />
          <span>
            {project.completed_tasks ?? 0}/{project.total_tasks ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users size={12} />
          <span>{project.member_count ?? 0}</span>
        </div>
        {days !== null && (
          <div className={cn(
            'flex items-center gap-1',
            days < 0 ? 'text-red-500' : days <= 7 ? 'text-amber-600' : 'text-gray-500',
          )}>
            <Calendar size={12} />
            <span>{days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}</span>
          </div>
        )}
      </div>

      {/* Budget bar */}
      {budgetPct !== null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Budget</span>
            <span className={cn(
              'text-xs font-medium',
              budgetPct > 90 ? 'text-red-600' : 'text-gray-500',
            )}>
              {budgetPct.toFixed(0)}% used
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className={cn(
                'h-1 rounded-full',
                budgetPct > 90 ? 'bg-red-500' : 'bg-purple-400',
              )}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: PM + deadline */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <Avatar name={project.manager_name ?? 'PM'} size="xs" />
          <span className="text-xs text-gray-500 truncate max-w-[100px]">
            {project.manager_name ?? '—'}
          </span>
        </div>
        {project.end_date && (
          <span className="text-xs text-gray-400">
            {formatDate(project.end_date, 'MMM d, yyyy')}
          </span>
        )}
      </div>
    </div>
  )
}

// ── List row ───────────────────────────────────────────────────────────────────
const ListRow = ({ project, onClick }: { project: Project; onClick: () => void }) => {
  const progress = project.progress ?? 0
  const days     = daysLeft(project.end_date)

  return (
    <tr
      onClick={onClick}
      className="hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
            {project.name}
          </p>
          {project.client_name && (
            <p className="text-xs text-gray-400 truncate">{project.client_name}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge
          label={project.status.replace(/_/g, ' ')}
          className={STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-600'}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Avatar name={project.manager_name ?? 'PM'} size="xs" />
          <span className="text-xs text-gray-600 truncate max-w-[100px]">
            {project.manager_name ?? '—'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={cn('h-1.5 rounded-full', progressColor(progress))}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600 w-8 text-right">
            {progress}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {project.budget != null
          ? `₹${project.budget.toLocaleString('en-IN')}`
          : '—'}
      </td>
      <td className="px-4 py-3">
        {project.end_date ? (
          <span className={cn(
            'text-xs',
            days !== null && days < 0
              ? 'text-red-600 font-medium'
              : days !== null && days <= 7
                ? 'text-amber-600'
                : 'text-gray-500',
          )}>
            {formatDate(project.end_date, 'MMM d, yyyy')}
            {days !== null && days < 0 && ' (overdue)'}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex -space-x-1.5">
          {Array.from({ length: Math.min(project.member_count ?? 0, 4) }).map((_, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[9px] text-gray-500"
            >
              {String.fromCharCode(65 + i)}
            </div>
          ))}
          {(project.member_count ?? 0) > 4 && (
            <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] text-gray-500">
              +{(project.member_count ?? 0) - 4}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
const CardSkeleton = () => (
  <div className="card p-5 space-y-3 animate-pulse">
    <div className="flex justify-between">
      <div className="h-4 bg-gray-200 rounded w-16" />
      <div className="h-4 bg-gray-200 rounded w-20" />
    </div>
    <div className="h-5 bg-gray-200 rounded w-3/4" />
    <div className="h-3 bg-gray-200 rounded w-1/2" />
    <div className="h-2 bg-gray-200 rounded w-full" />
    <div className="flex gap-4">
      <div className="h-3 bg-gray-200 rounded w-12" />
      <div className="h-3 bg-gray-200 rounded w-12" />
      <div className="h-3 bg-gray-200 rounded w-16" />
    </div>
  </div>
)

// ── Main ───────────────────────────────────────────────────────────────────────
const ProjectsPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isManager } = useAuth()

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [search, setSearch]             = useState('')
  const [viewMode, setViewMode]         = useState<'grid' | 'list'>('grid')
  const [createOpen, setCreateOpen]     = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', statusFilter, debouncedSearch],
    queryFn: () =>
      projectService.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: debouncedSearch || undefined,
      }),
    staleTime: 1000 * 30,
  })

  const projects: Project[] = data?.projects ?? []

  const canCreate = isAdmin || isManager

  return (
    <div className="space-y-5">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                statusFilter === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-3 py-2 transition-colors',
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-2 transition-colors',
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50',
              )}
            >
              <List size={15} />
            </button>
          </div>

          {/* Create button */}
          {canCreate && (
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => setCreateOpen(true)}
            >
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="card overflow-hidden p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        )
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={40} className="text-gray-300" />}
          title="No projects found"
          description={
            debouncedSearch
              ? `No projects match "${debouncedSearch}".`
              : statusFilter !== 'all'
                ? `No ${statusFilter.replace(/_/g, ' ')} projects.`
                : 'Get started by creating your first project.'
          }
          action={
            canCreate ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setCreateOpen(true)}
              >
                New Project
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(ROUTES.PROJECT_DETAIL.replace(':id', p.id))}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Project', 'Status', 'Manager', 'Progress', 'Budget', 'Deadline', 'Team'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-gray-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((p) => (
                  <ListRow
                    key={p.id}
                    project={p}
                    onClick={() => navigate(ROUTES.PROJECT_DETAIL.replace(':id', p.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Archived note ────────────────────────────────────── */}
      {statusFilter === 'all' && projects.length > 0 && (
        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <Archive size={11} />
          Archived projects are hidden. Use the status filter to view them.
        </p>
      )}

      {/* ── Create modal ─────────────────────────────────────── */}
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

export default ProjectsPage
