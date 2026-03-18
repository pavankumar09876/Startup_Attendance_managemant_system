import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, ChevronDown, ChevronRight } from 'lucide-react'
import api from '@/services/api'
import Avatar from '@/components/common/Avatar'
import { cn } from '@/utils/cn'

interface OrgNode {
  id: string
  name: string
  role: string
  designation?: string
  department?: string
  avatar_url?: string
  manager_id?: string
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  hr:          'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  manager:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  employee:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  hr: 'HR',
  manager: 'Manager',
  employee: 'Employee',
}

const DEPT_ACCENT: Record<string, string> = {
  engineering: 'from-blue-500 to-blue-600',
  design:      'from-purple-500 to-purple-600',
  marketing:   'from-green-500 to-green-600',
  sales:       'from-orange-500 to-orange-600',
  hr:          'from-pink-500 to-pink-600',
  finance:     'from-teal-500 to-teal-600',
}

const OrgChart = () => {
  const [zoom, setZoom] = useState(1)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => api.get<OrgNode[]>('/api/users/org-chart').then(r => r.data),
  })

  const { childrenMap, roots } = useMemo(() => {
    const cMap: Record<string, OrgNode[]> = {}
    const rts: OrgNode[] = []
    nodes.forEach(n => {
      if (n.manager_id && nodes.find(x => x.id === n.manager_id)) {
        cMap[n.manager_id] = [...(cMap[n.manager_id] || []), n]
      } else {
        rts.push(n)
      }
    })
    return { childrenMap: cMap, roots: rts }
  }, [nodes])

  const matchIds = useMemo(() => {
    if (!search.trim()) return new Set<string>()
    const q = search.toLowerCase()
    const matches = new Set<string>()
    nodes.forEach(n => {
      if (
        n.name.toLowerCase().includes(q) ||
        n.designation?.toLowerCase().includes(q) ||
        n.department?.toLowerCase().includes(q) ||
        n.role.toLowerCase().includes(q)
      ) {
        matches.add(n.id)
      }
    })
    return matches
  }, [search, nodes])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => {
    const allWithChildren = nodes.filter(n => childrenMap[n.id]?.length).map(n => n.id)
    setCollapsed(new Set(allWithChildren))
  }, [nodes, childrenMap])

  // ── Node Card ──────────────────────────────────────────────
  const NodeCard = ({ node, depth = 0 }: { node: OrgNode; depth?: number }) => {
    const children = childrenMap[node.id] || []
    const isCollapsed = collapsed.has(node.id)
    const isMatch = matchIds.size > 0 && matchIds.has(node.id)
    const deptKey = (node.department || '').toLowerCase()
    const accentGradient = DEPT_ACCENT[deptKey] || 'from-gray-400 to-gray-500'
    const initials = node.name.split(' ').map(w => w[0]).join('').slice(0, 2)

    return (
      <div className="flex flex-col items-center">
        {/* Card */}
        <div
          className={cn(
            'relative w-52 rounded-xl overflow-hidden transition-all',
            'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
            'hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600',
            isMatch && 'ring-2 ring-yellow-400 shadow-yellow-100 dark:shadow-yellow-900/20',
          )}
        >
          {/* Accent bar */}
          <div className={cn('h-1 bg-gradient-to-r', accentGradient)} />

          <div className="p-3.5">
            {/* Avatar + name */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className={cn(
                'w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-xs flex-shrink-0',
                accentGradient,
              )}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                  {node.name}
                </p>
                {node.designation && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {node.designation}
                  </p>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn(
                'inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full',
                ROLE_COLORS[node.role] || 'bg-gray-100 text-gray-600',
              )}>
                {ROLE_LABELS[node.role] ?? node.role}
              </span>
              {node.department && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {node.department}
                </span>
              )}
            </div>
          </div>

          {/* Expand/collapse */}
          {children.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id) }}
              className={cn(
                'absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-10',
                'w-7 h-7 rounded-full flex items-center justify-center',
                'bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-600',
                'text-gray-500 dark:text-gray-400 text-xs font-medium',
                'hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400',
                'shadow-sm transition-all',
              )}
            >
              {isCollapsed ? children.length : '−'}
            </button>
          )}
        </div>

        {/* Children tree */}
        {children.length > 0 && !isCollapsed && (
          <div className="flex flex-col items-center">
            {/* Vertical connector from parent */}
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

            {children.length === 1 ? (
              <NodeCard node={children[0]} depth={depth + 1} />
            ) : (
              <div className="relative flex gap-8">
                {/* Horizontal connector line */}
                <div
                  className="absolute top-0 h-px bg-gray-300 dark:bg-gray-600"
                  style={{
                    left: `calc(${100 / (2 * children.length)}% + 0px)`,
                    right: `calc(${100 / (2 * children.length)}% + 0px)`,
                  }}
                />
                {children.map(child => (
                  <div key={child.id} className="flex flex-col items-center">
                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
                    <NodeCard node={child} depth={depth + 1} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading org chart…</p>
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="card flex items-center justify-center h-64 text-center">
        <div>
          <GitBranchPlaceholder />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-3">No org data</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add employees with manager relationships to see the org chart.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="card p-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search people, roles, departments…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm
                bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900 focus:outline-none"
            />
          </div>

          {search && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {matchIds.size} result{matchIds.size !== 1 ? 's' : ''}
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Zoom controls */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
                className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-center font-medium">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                title="Reset zoom"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

            {/* Expand/Collapse */}
            <button
              onClick={() => setCollapsed(new Set())}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Maximize2 size={12} />
              Expand
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Minimize2 size={12} />
              Collapse
            </button>
          </div>
        </div>

        {/* Department legend */}
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mr-1">
            Departments
          </span>
          {Object.entries(DEPT_ACCENT).map(([dept, gradient]) => (
            <span key={dept} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className={cn('w-2.5 h-2.5 rounded-sm bg-gradient-to-br', gradient)} />
              <span className="capitalize">{dept}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Tree canvas ──────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="overflow-auto card p-8"
        style={{ maxHeight: '70vh' }}
      >
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          className="inline-flex gap-16 min-w-max transition-transform duration-200"
        >
          {roots.map(r => <NodeCard key={r.id} node={r} />)}
        </div>
      </div>

      {/* ── Stats footer ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-1 text-xs text-gray-400 dark:text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          {nodes.length} people
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          {roots.length} top-level
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {nodes.filter(n => n.role === 'manager').length} managers
        </span>
      </div>
    </div>
  )
}

// Placeholder icon for empty state
const GitBranchPlaceholder = () => (
  <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12m0 0a3 3 0 103 3H15a3 3 0 100-3m-9 0H6m12-6V3m0 6a3 3 0 01-3 3H9a3 3 0 110-6" />
  </svg>
)

export default OrgChart
