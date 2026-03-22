import { useQuery } from '@tanstack/react-query'
import { Circle, CheckCircle2 } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import Spinner from '@/components/common/Spinner'
import EmptyState from '@/components/common/EmptyState'
import Badge from '@/components/common/Badge'
import {
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_COLORS,
} from '@/types/onboarding.types'
import type { StatusTransition } from '@/types/onboarding.types'

interface Props {
  employeeId: string
  currentStatus?: string
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const timeBetween = (from: string, to: string) => {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h`
  return '<1h'
}

const EmployeeTimeline = ({ employeeId, currentStatus }: Props) => {
  const { data: transitions = [], isLoading } = useQuery({
    queryKey: ['employee-transitions', employeeId],
    queryFn: () => onboardingService.getTransitions(employeeId),
  })

  if (isLoading) {
    return <div className="flex justify-center py-6"><Spinner /></div>
  }

  if (transitions.length === 0) {
    return (
      <EmptyState
        title="No transitions recorded"
        description="Status transitions will appear here as the employee moves through the pipeline."
        compact
      />
    )
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-0">
        {transitions.map((t, idx) => (
          <TimelineEntry
            key={t.id}
            transition={t}
            isLast={idx === transitions.length - 1}
            isCurrent={idx === transitions.length - 1 && t.to_status === currentStatus}
            duration={
              idx < transitions.length - 1
                ? timeBetween(t.created_at, transitions[idx + 1].created_at)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}

const TimelineEntry = ({
  transition,
  isLast,
  isCurrent,
  duration,
}: {
  transition: StatusTransition
  isLast: boolean
  isCurrent: boolean
  duration?: string
}) => {
  const toLabel = EMPLOYEE_STATUS_LABELS[transition.to_status] || transition.to_status
  const fromLabel = transition.from_status
    ? EMPLOYEE_STATUS_LABELS[transition.from_status] || transition.from_status
    : null

  return (
    <div className="relative flex gap-3 pb-6">
      {/* Dot */}
      <div className="relative z-10 flex-shrink-0 mt-0.5">
        {isCurrent ? (
          <div className="w-[30px] h-[30px] rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Circle size={12} className="text-blue-600 fill-blue-600" />
          </div>
        ) : (
          <div className="w-[30px] h-[30px] rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle2 size={14} className="text-green-600" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {fromLabel && (
            <>
              <Badge
                label={fromLabel}
                className={`text-[10px] px-1.5 py-0 ${EMPLOYEE_STATUS_COLORS[transition.from_status!] || 'bg-gray-100 text-gray-500'}`}
              />
              <span className="text-gray-400 text-xs">&rarr;</span>
            </>
          )}
          <Badge
            label={toLabel}
            className={EMPLOYEE_STATUS_COLORS[transition.to_status] || 'bg-gray-100 text-gray-600'}
          />
          {isCurrent && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
              Current
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-1">
          {formatDate(transition.created_at)}
        </p>

        {transition.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
            {transition.notes}
          </p>
        )}

        {duration && (
          <p className="text-[10px] text-gray-400 mt-1">
            ⏱ {duration} in this status
          </p>
        )}
      </div>
    </div>
  )
}

export default EmployeeTimeline
