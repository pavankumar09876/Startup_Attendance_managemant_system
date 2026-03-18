import { type ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/utils/cn'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon: ReactNode
  iconBg: string       // e.g. 'bg-blue-100'
  iconColor: string    // e.g. 'text-blue-600'
  trend?: number       // positive = up, negative = down, undefined = neutral
  trendLabel?: string  // e.g. 'vs last month'
}

const StatCard = ({
  label, value, subtext, icon, iconBg, iconColor, trend, trendLabel,
}: StatCardProps) => {
  const trendUp      = trend !== undefined && trend > 0
  const trendDown    = trend !== undefined && trend < 0
  const trendNeutral = trend !== undefined && trend === 0

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
          <span className={iconColor}>{icon}</span>
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5',
              trendUp      && 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
              trendDown    && 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
              trendNeutral && 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
            )}
          >
            {trendUp      && <TrendingUp size={11} />}
            {trendDown    && <TrendingDown size={11} />}
            {trendNeutral && <Minus size={11} />}
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
      {trendLabel && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{trendLabel}</p>
      )}
    </div>
  )
}

export default StatCard
