/**
 * OnboardingChecklist — shown to new employees on first login.
 * Tracks completion of setup tasks. Dismissible.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'

const STORAGE_KEY = 'wfp-onboarding'

interface ChecklistItem {
  id:          string
  title:       string
  description: string
  link?:       string
  check:       (user: any) => boolean
}

const ITEMS: ChecklistItem[] = [
  {
    id: 'profile_photo',
    title: 'Upload a profile photo',
    description: 'Add a photo so your teammates can recognise you.',
    link: ROUTES.SETTINGS,
    check: (u) => !!u?.avatar_url,
  },
  {
    id: 'complete_profile',
    title: 'Complete your personal info',
    description: 'Add your phone number and date of birth.',
    link: ROUTES.SETTINGS,
    check: (u) => !!u?.phone,
  },
  {
    id: 'first_checkin',
    title: 'Mark your first attendance',
    description: 'Check in to start tracking your attendance.',
    link: ROUTES.ATTENDANCE,
    check: () => {
      // Check localStorage flag set after first check-in
      return localStorage.getItem('wfp-first-checkin') === '1'
    },
  },
  {
    id: 'explore_tasks',
    title: 'View your assigned tasks',
    description: 'See what tasks are waiting for you.',
    link: ROUTES.TASKS,
    check: () => localStorage.getItem('wfp-tasks-visited') === '1',
  },
  {
    id: 'notifications',
    title: 'Set up notification preferences',
    description: 'Choose how you want to be notified.',
    link: ROUTES.SETTINGS,
    check: () => localStorage.getItem('wfp-notif-setup') === '1',
  },
]

const OnboardingChecklist = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const [collapsed,  setCollapsed] = useState(false)

  // Read dismissed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const { dismissed: d } = JSON.parse(stored)
      if (d) setDismissed(true)
    }
  }, [])

  const completedItems = ITEMS.filter((item) => item.check(user))
  const total     = ITEMS.length
  const completed = completedItems.length
  const pct       = Math.round((completed / total) * 100)
  const allDone   = completed === total

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: true }))
  }

  // Auto-dismiss after all done (after 3s)
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(dismiss, 3000)
      return () => clearTimeout(t)
    }
  }, [allDone])

  if (dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 w-72 bg-white dark:bg-gray-900
      rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3',
        allDone ? 'bg-green-50 dark:bg-green-950' : 'bg-blue-50 dark:bg-blue-950',
      )}>
        <Sparkles size={16} className={allDone ? 'text-green-500' : 'text-blue-500'} />
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-800 dark:text-white">
            {allDone ? 'Setup complete! 🎉' : 'Get started'}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{completed}/{total} done</p>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5">
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-gray-700">
        <div
          className={cn('h-full transition-all duration-500', allDone ? 'bg-green-500' : 'bg-blue-500')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {ITEMS.map((item) => {
            const done = item.check(user)
            return (
              <button
                key={item.id}
                onClick={() => item.link && navigate(item.link)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                  done
                    ? 'opacity-60 cursor-default'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer',
                )}
              >
                {done ? (
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Circle size={16} className="text-gray-300 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={cn(
                    'text-xs font-medium',
                    done ? 'line-through text-gray-400' : 'text-gray-800 dark:text-white',
                  )}>
                    {item.title}
                  </p>
                  {!done && (
                    <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default OnboardingChecklist
