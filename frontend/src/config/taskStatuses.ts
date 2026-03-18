/**
 * Single source of truth for task statuses.
 *
 * Every Kanban board, sprint column, and filter reads from this file.
 * To add / remove / reorder statuses, edit ONLY this file.
 */
import type { TaskStatus } from '@/types/project.types'

export interface StatusConfig {
  /** Machine key — must match backend TaskStatus enum value */
  value: TaskStatus
  /** Human-readable label */
  label: string
  /** Tailwind classes for the column header text */
  headerColor: string
  /** Tailwind classes for the count badge */
  countColor: string
  /** Whether to show in sprint mini-board (e.g. "blocked" is excluded) */
  showInSprint: boolean
}

/**
 * Ordered list of task statuses.
 * The order here determines column order in every Kanban / sprint board.
 */
export const TASK_STATUSES: StatusConfig[] = [
  {
    value: 'todo',
    label: 'Todo',
    headerColor: 'text-gray-700 dark:text-gray-200',
    countColor: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    showInSprint: true,
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    headerColor: 'text-blue-700',
    countColor: 'bg-blue-100 text-blue-700',
    showInSprint: true,
  },
  {
    value: 'in_review',
    label: 'In Review',
    headerColor: 'text-purple-700',
    countColor: 'bg-purple-100 text-purple-700',
    showInSprint: true,
  },
  {
    value: 'done',
    label: 'Done',
    headerColor: 'text-green-700',
    countColor: 'bg-green-100 text-green-700',
    showInSprint: true,
  },
  {
    value: 'blocked',
    label: 'Blocked',
    headerColor: 'text-red-700',
    countColor: 'bg-red-100 text-red-700',
    showInSprint: false,
  },
]

/** All status keys in display order */
export const ALL_STATUS_KEYS: TaskStatus[] = TASK_STATUSES.map((s) => s.value)

/** Only the statuses shown inside sprint mini-boards */
export const SPRINT_STATUS_KEYS: TaskStatus[] = TASK_STATUSES
  .filter((s) => s.showInSprint)
  .map((s) => s.value)

/** Lookup maps for quick access by status key */
export const STATUS_LABEL_MAP: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.label]),
) as Record<TaskStatus, string>

export const STATUS_HEADER_COLOR_MAP: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.headerColor]),
) as Record<TaskStatus, string>

export const STATUS_COUNT_COLOR_MAP: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.countColor]),
) as Record<TaskStatus, string>
