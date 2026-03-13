import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'

export const formatDate = (date: string | Date, fmt = 'MMM dd, yyyy'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? format(d, fmt) : '—'
}

export const formatTime = (date: string | Date): string =>
  formatDate(date, 'hh:mm a')

export const formatDateTime = (date: string | Date): string =>
  formatDate(date, 'MMM dd, yyyy hh:mm a')

export const timeAgo = (date: string | Date): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '—'
}
