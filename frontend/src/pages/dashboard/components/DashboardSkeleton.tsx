const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-gray-200 animate-pulse rounded-lg ${className}`} />
)

const StatCardSkeleton = () => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-4">
      <Pulse className="w-10 h-10 rounded-xl" />
      <Pulse className="w-16 h-5 rounded-full" />
    </div>
    <Pulse className="w-24 h-3 mb-2" />
    <Pulse className="w-20 h-7 mb-1" />
    <Pulse className="w-32 h-3" />
  </div>
)

const ChartSkeleton = ({ height = 'h-48' }: { height?: string }) => (
  <div className="card p-5">
    <Pulse className="w-32 h-4 mb-4" />
    <Pulse className={`w-full ${height}`} />
  </div>
)

const TableSkeleton = () => (
  <div className="card p-5">
    <Pulse className="w-40 h-4 mb-4" />
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
        <Pulse className="w-8 h-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Pulse className="w-32 h-3" />
          <Pulse className="w-20 h-3" />
        </div>
        <Pulse className="w-16 h-5 rounded-full" />
      </div>
    ))}
  </div>
)

export const AdminDashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartSkeleton height="h-56" />
      <ChartSkeleton height="h-56" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <ChartSkeleton height="h-44" />
      <TableSkeleton />
      <TableSkeleton />
    </div>
  </div>
)

export const ManagerDashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartSkeleton height="h-56" />
      <ChartSkeleton height="h-56" />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <TableSkeleton />
      <TableSkeleton />
    </div>
  </div>
)

export const EmployeeDashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <ChartSkeleton height="h-48" />
      <TableSkeleton />
      <TableSkeleton />
    </div>
  </div>
)
