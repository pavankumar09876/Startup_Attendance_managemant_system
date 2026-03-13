import { type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  icon?:        ReactNode
  title:        string
  description?: string
  action?:      ReactNode
  className?:   string
  compact?:     boolean
}

// ── Inline SVG illustrations ──────────────────────────────────────────────────
export const illustrations = {
  tasks: (
    <svg viewBox="0 0 120 80" fill="none" className="w-24 h-16 mx-auto">
      <rect x="10" y="20" width="100" height="12" rx="4" fill="#E5E7EB"/>
      <rect x="10" y="38" width="80"  height="12" rx="4" fill="#E5E7EB"/>
      <rect x="10" y="56" width="60"  height="12" rx="4" fill="#E5E7EB"/>
      <circle cx="5" cy="26" r="3" fill="#D1D5DB"/>
      <circle cx="5" cy="44" r="3" fill="#D1D5DB"/>
      <circle cx="5" cy="62" r="3" fill="#D1D5DB"/>
    </svg>
  ),
  employees: (
    <svg viewBox="0 0 120 80" fill="none" className="w-24 h-16 mx-auto">
      <circle cx="40" cy="30" r="16" fill="#E5E7EB"/>
      <circle cx="80" cy="30" r="16" fill="#E5E7EB"/>
      <path d="M10 72c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="#D1D5DB" strokeWidth="2"/>
      <path d="M50 72c0-16.569 13.431-30 30-30s30 13.431 30 30" stroke="#D1D5DB" strokeWidth="2"/>
    </svg>
  ),
  projects: (
    <svg viewBox="0 0 120 80" fill="none" className="w-24 h-16 mx-auto">
      <rect x="5"  y="10" width="50" height="60" rx="6" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1.5"/>
      <rect x="65" y="20" width="50" height="50" rx="6" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1.5"/>
      <rect x="15" y="22" width="30" height="4" rx="2" fill="#BFDBFE"/>
      <rect x="15" y="32" width="20" height="4" rx="2" fill="#BFDBFE"/>
      <rect x="75" y="32" width="30" height="4" rx="2" fill="#BBF7D0"/>
      <rect x="75" y="42" width="20" height="4" rx="2" fill="#BBF7D0"/>
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 80 80" fill="none" className="w-16 h-16 mx-auto">
      <path d="M40 10 C25 10 15 22 15 35 L15 50 L8 58 L72 58 L65 50 L65 35 C65 22 55 10 40 10Z"
        fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1.5"/>
      <path d="M33 62 C33 65.866 36.134 69 40 69 C43.866 69 47 65.866 47 62"
        stroke="#D1D5DB" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  payroll: (
    <svg viewBox="0 0 120 80" fill="none" className="w-24 h-16 mx-auto">
      <rect x="10" y="10" width="100" height="60" rx="8" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1.5"/>
      <text x="38" y="52" fontSize="28" fill="#D1FAE5" fontFamily="serif">₹</text>
      <rect x="22" y="22" width="40" height="6" rx="2" fill="#BBF7D0"/>
      <rect x="22" y="34" width="28" height="4" rx="2" fill="#D1FAE5"/>
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 120 80" fill="none" className="w-24 h-16 mx-auto">
      <rect x="10"  y="60" width="16" height="14" rx="2" fill="#BFDBFE"/>
      <rect x="32"  y="44" width="16" height="30" rx="2" fill="#93C5FD"/>
      <rect x="54"  y="28" width="16" height="46" rx="2" fill="#60A5FA"/>
      <rect x="76"  y="36" width="16" height="38" rx="2" fill="#3B82F6"/>
      <rect x="98"  y="16" width="16" height="58" rx="2" fill="#2563EB"/>
    </svg>
  ),
  leaves: (
    <svg viewBox="0 0 120 80" fill="none" className="w-24 h-16 mx-auto">
      <rect x="10" y="10" width="100" height="60" rx="8" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="1.5"/>
      <rect x="22" y="22" width="76" height="8" rx="2" fill="#FDE68A"/>
      <circle cx="32" cy="44" r="4" fill="#FDE68A"/>
      <circle cx="32" cy="58" r="4" fill="#FDE68A"/>
      <rect x="42" y="40" width="44" height="4" rx="2" fill="#FEF3C7"/>
      <rect x="42" y="54" width="30" height="4" rx="2" fill="#FEF3C7"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 80 80" fill="none" className="w-16 h-16 mx-auto">
      <circle cx="34" cy="34" r="20" stroke="#D1D5DB" strokeWidth="2" fill="#F3F4F6"/>
      <line x1="48" y1="48" x2="66" y2="66" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="34" cy="34" r="10" stroke="#E5E7EB" strokeWidth="1.5" fill="none" strokeDasharray="3 3"/>
    </svg>
  ),
  generic: (
    <svg viewBox="0 0 80 80" fill="none" className="w-16 h-16 mx-auto">
      <circle cx="40" cy="40" r="30" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1.5"/>
      <path d="M30 38 L38 46 L52 30" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
}

export type IllustrationType = keyof typeof illustrations

const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) => (
  <div className={cn(
    'flex flex-col items-center justify-center text-center',
    compact ? 'py-10 px-4' : 'py-16 px-8',
    className,
  )}>
    {icon && <div className="mb-4 opacity-80">{icon}</div>}
    <h3 className={cn(
      'font-semibold text-gray-700 dark:text-gray-300',
      compact ? 'text-sm' : 'text-base',
    )}>
      {title}
    </h3>
    {description && (
      <p className={cn(
        'text-gray-400 dark:text-gray-500 mt-1',
        compact ? 'text-xs' : 'text-sm',
      )}>
        {description}
      </p>
    )}
    {action && <div className={compact ? 'mt-3' : 'mt-5'}>{action}</div>}
  </div>
)

// ── Named empty states for common pages ──────────────────────────────────────
export const EmptyTasks = ({ onAdd }: { onAdd?: () => void }) => (
  <EmptyState
    icon={illustrations.tasks}
    title="No tasks yet"
    description="Create a task to start tracking work."
    action={onAdd ? (
      <button onClick={onAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        + New Task
      </button>
    ) : undefined}
  />
)

export const EmptyEmployees = ({ onAdd }: { onAdd?: () => void }) => (
  <EmptyState
    icon={illustrations.employees}
    title="No employees found"
    description="Try a different search or add a new employee."
    action={onAdd ? (
      <button onClick={onAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        + Add Employee
      </button>
    ) : undefined}
  />
)

export const EmptyProjects = ({ onAdd }: { onAdd?: () => void }) => (
  <EmptyState
    icon={illustrations.projects}
    title="No projects yet"
    description="Create your first project to start managing work."
    action={onAdd ? (
      <button onClick={onAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        + New Project
      </button>
    ) : undefined}
  />
)

export const EmptyPayroll = () => (
  <EmptyState icon={illustrations.payroll} title="No payroll records" description="Run payroll for this month to generate records." />
)

export const EmptyLeaves = () => (
  <EmptyState icon={illustrations.leaves} title="No leave requests" description="Apply for a leave to see it here." compact />
)

export const EmptyNotifications = () => (
  <EmptyState icon={illustrations.notifications} title="You're all caught up" description="No new notifications." compact />
)

export const EmptyReports = () => (
  <EmptyState icon={illustrations.reports} title="No data available" description="Adjust filters or date range to see report data." compact />
)

export const EmptySearch = ({ query }: { query: string }) => (
  <EmptyState icon={illustrations.search} title={`No results for "${query}"`} description="Try different keywords." compact />
)

export default EmptyState
