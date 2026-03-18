/**
 * BurndownChart — shows remaining tasks vs days left for a project.
 * Uses AreaChart from Recharts.
 */
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { differenceInDays, eachDayOfInterval, format, parseISO } from 'date-fns'
import { taskService } from '@/services/task.service'
import { ChartSkeleton } from '@/components/common/Skeleton'

interface Props {
  projectId: string
  startDate: string   // YYYY-MM-DD
  endDate:   string   // YYYY-MM-DD
  totalTasks: number
}

const BurndownChart = ({ projectId, startDate, endDate, totalTasks }: Props) => {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['project-tasks-burndown', projectId],
    queryFn:  () => taskService.getProjectTasks(projectId),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <ChartSkeleton height={200} />

  const start = parseISO(startDate)
  const end   = parseISO(endDate)
  const today = new Date()

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        Set start and end dates to see the burndown chart.
      </div>
    )
  }

  const totalDays  = differenceInDays(end, start) + 1
  const totalItems = totalTasks || tasks.length

  // Ideal burndown: linear from totalItems to 0
  const days = eachDayOfInterval({ start, end })

  // Count tasks completed per day (using created_at as proxy — ideally use updated_at + status change)
  // For now, build from what we have
  const doneTasks = tasks.filter((t: any) => t.status === 'done')

  const data = days.map((d, i) => {
    const label    = format(d, 'MMM d')
    const ideal    = Math.max(0, Math.round(totalItems - (totalItems / (totalDays - 1)) * i))
    const isPast   = d <= today
    // Actual: count tasks NOT yet done as of that day (simplified)
    const doneByDay = doneTasks.length * (isPast ? Math.min(1, i / Math.max(1, differenceInDays(today, start))) : 0)
    const actual   = isPast ? Math.max(0, Math.round(totalItems - doneByDay)) : null

    return { label, ideal, actual }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Burndown Chart</h4>
        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-500 inline-block" />Ideal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-green-500 inline-block" />Actual
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="idealGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#16A34A" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            interval={Math.floor(days.length / 5)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            domain={[0, totalItems]}
          />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: 12 }}
            formatter={(v: any, name: string) => [v !== null ? v : '–', name === 'ideal' ? 'Ideal remaining' : 'Actual remaining']}
          />
          <ReferenceLine
            x={format(today, 'MMM d')}
            stroke="#EF4444"
            strokeDasharray="4 4"
            label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#EF4444' }}
          />
          <Area type="monotone" dataKey="ideal"  stroke="#2563EB" strokeWidth={2} fill="url(#idealGrad)"  dot={false} connectNulls />
          <Area type="monotone" dataKey="actual" stroke="#16A34A" strokeWidth={2} fill="url(#actualGrad)" dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default BurndownChart
