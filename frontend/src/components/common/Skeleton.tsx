import React from 'react'
import { cn } from '@/utils/cn'

// ── Base skeleton block ───────────────────────────────────────────────────────
export const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={cn('animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md', className)} style={style} />
)

// ── Reusable skeleton compositions ───────────────────────────────────────────

/** Stat card skeleton (4-card grid row) */
export const StatCardSkeleton = () => (
  <div className="card p-5 space-y-3">
    <div className="flex justify-between items-start">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
    <Skeleton className="h-7 w-32" />
    <Skeleton className="h-3 w-20" />
  </div>
)

/** Table row skeleton */
export const TableRowSkeleton = ({ cols = 5 }: { cols?: number }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className={cn('h-4', i === 0 ? 'w-36' : i === cols - 1 ? 'w-16' : 'w-24')} />
      </td>
    ))}
  </tr>
)

/** Full table skeleton */
export const TableSkeleton = ({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) => (
  <div className="card overflow-hidden">
    {/* Header */}
    <div className="flex gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-9 w-32" />
      <div className="ml-auto">
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
    <table className="w-full">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800">
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i} className="px-4 py-3">
              <Skeleton className="h-3 w-16" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
)

/** Employee card grid skeleton */
export const EmployeeCardSkeleton = () => (
  <div className="card p-4 space-y-3">
    <div className="flex flex-col items-center gap-2 py-2">
      <Skeleton className="w-16 h-16 rounded-full" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
    <Skeleton className="h-5 w-16 rounded-full mx-auto" />
    <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-700">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  </div>
)

/** Kanban column skeleton */
export const KanbanSkeleton = () => (
  <div className="flex gap-4 overflow-x-auto pb-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="w-64 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>
        {Array.from({ length: 3 + Math.floor(Math.random() * 2) }).map((_, j) => (
          <div key={j} className="card p-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="flex justify-between pt-1">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="w-6 h-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
)

/** Chart card skeleton */
export const ChartSkeleton = ({ height = 240 }: { height?: number }) => (
  <div className="card p-5 space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-7 w-24 rounded-lg" />
    </div>
    <Skeleton className={`w-full rounded-lg`} style={{ height }} />
  </div>
)

/** Payroll table skeleton */
export const PayrollSkeleton = () => (
  <div className="space-y-4">
    {/* Summary cards */}
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <TableSkeleton rows={8} cols={7} />
  </div>
)
