import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Users, Calendar } from 'lucide-react'

import { sprintService } from '@/services/sprint.service'
import type { MemberWorkload } from '@/types/project.types'
import Avatar from '@/components/common/Avatar'
import { cn } from '@/utils/cn'

interface Props {
  sprintId: string
  capacity?: number
}

const WorkloadBar = ({ member, maxPts }: { member: MemberWorkload; maxPts: number }) => {
  const pct = maxPts > 0 ? Math.min(100, (member.story_points / maxPts) * 100) : 0
  const donePct = member.task_count > 0
    ? Math.round((member.completed_tasks / member.task_count) * 100)
    : 0

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar name={member.name} src={member.avatar} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
            {member.name}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
            <span>{member.story_points} pts</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{member.task_count} tasks</span>
            {member.leave_days > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-amber-500 flex items-center gap-0.5">
                  <Calendar size={9} />
                  {member.leave_days}d off
                </span>
              </>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 relative overflow-hidden">
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-500',
              pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-blue-400',
            )}
            style={{ width: `${pct}%` }}
          />
          {/* Done portion overlay */}
          {donePct > 0 && (
            <div
              className="absolute top-0 left-0 h-2 rounded-full bg-green-400 opacity-60"
              style={{ width: `${(donePct / 100) * pct}%` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const SprintWorkloadPanel = ({ sprintId, capacity }: Props) => {
  const { data: workload, isLoading } = useQuery({
    queryKey: ['sprint-workload', sprintId],
    queryFn: () => sprintService.getWorkload(sprintId),
    staleTime: 1000 * 30,
  })

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!workload || workload.members.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">
        <Users size={20} className="mx-auto mb-1 opacity-50" />
        No members assigned to tasks in this sprint
      </div>
    )
  }

  const maxPts = Math.max(
    ...workload.members.map((m) => m.story_points),
    capacity ?? 0,
    1,
  )

  return (
    <div className="space-y-3">
      {/* Capacity summary */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <Users size={12} />
          Team Workload
        </span>
        <span className={cn(
          'font-medium',
          workload.over_capacity ? 'text-red-500' : 'text-gray-600 dark:text-gray-300',
        )}>
          {workload.total_story_points}
          {capacity ? ` / ${capacity} pts` : ' pts total'}
        </span>
      </div>

      {/* Over-capacity warning */}
      {workload.over_capacity && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20
          border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            Sprint is <strong>{workload.total_story_points - (capacity ?? 0)} pts</strong> over capacity
          </span>
        </div>
      )}

      {/* Capacity bar (total) */}
      {capacity && (
        <div className="relative">
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className={cn(
                'h-3 rounded-full transition-all duration-500',
                workload.over_capacity ? 'bg-red-400' : 'bg-blue-400',
              )}
              style={{ width: `${Math.min(100, (workload.total_story_points / capacity) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>0</span>
            <span>{capacity} pts</span>
          </div>
        </div>
      )}

      {/* Per-member bars */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {workload.members.map((m) => (
          <WorkloadBar key={m.user_id} member={m} maxPts={maxPts} />
        ))}
      </div>

      {/* Unassigned */}
      {workload.unassigned_tasks > 0 && (
        <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500
          border-t border-gray-100 dark:border-gray-800 pt-2">
          <span>Unassigned</span>
          <span>{workload.unassigned_points} pts · {workload.unassigned_tasks} tasks</span>
        </div>
      )}
    </div>
  )
}

export default SprintWorkloadPanel
