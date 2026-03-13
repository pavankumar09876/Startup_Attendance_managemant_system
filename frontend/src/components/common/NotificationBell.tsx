import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '@/hooks/useWebSocket'
import api from '@/services/api'
import { cn } from '@/utils/cn'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string
  is_read: boolean
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  leave_approved:     'bg-green-100 text-green-600',
  leave_rejected:     'bg-red-100 text-red-600',
  task_assigned:      'bg-blue-100 text-blue-600',
  payslip_ready:      'bg-purple-100 text-purple-600',
  expense_reviewed:   'bg-orange-100 text-orange-600',
  project_deadline:   'bg-amber-100 text-amber-600',
  general:            'bg-gray-100 text-gray-600',
}

const fetchNotifications = () =>
  api.get<Notification[]>('/api/notifications?limit=20').then((r) => r.data)

const fetchUnreadCount = () =>
  api.get<{ count: number }>('/api/notifications/unread-count').then((r) => r.data.count)

const NotificationBell = () => {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 1000 * 30,
  })

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
    staleTime: 1000 * 30,
  })

  // WebSocket — push new notifications in real-time
  useWebSocket({
    onMessage: (msg) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (old = []) => [
        { ...msg, created_at: new Date().toISOString() } as Notification,
        ...old,
      ])
      queryClient.setQueryData<number>(['notifications-count'], (old = 0) => old + 1)
    },
  })

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (old = []) =>
        old.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      )
      queryClient.setQueryData<number>(['notifications-count'], (old = 0) => Math.max(0, old - 1))
    },
  })

  const { mutate: markAllRead } = useMutation({
    mutationFn: () => api.patch('/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(['notifications'], (old = []) =>
        old.map((n) => ({ ...n, is_read: true })),
      )
      queryClient.setQueryData<number>(['notifications-count'], 0)
    },
  })

  const handleNotifClick = (notif: Notification) => {
    if (!notif.is_read) markRead(notif.id)
    if (notif.link) {
      navigate(notif.link)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
          open && 'bg-gray-100 dark:bg-gray-800',
        )}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full
            text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900
          border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                    notif.is_read
                      ? 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      : 'bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5',
                    TYPE_COLORS[notif.type] ?? TYPE_COLORS.general,
                  )}>
                    {notif.type === 'leave_approved' ? '✓' :
                     notif.type === 'task_assigned' ? '→' :
                     notif.type === 'payslip_ready' ? '₹' : '●'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-xs font-semibold truncate',
                      notif.is_read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white',
                    )}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {notif.link && <ExternalLink size={11} className="text-gray-400" />}
                    {!notif.is_read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
