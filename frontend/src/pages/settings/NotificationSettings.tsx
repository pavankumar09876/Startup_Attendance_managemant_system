import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Mail, Bell } from 'lucide-react'

import { settingsService } from '@/services/settings.service'
import type { NotificationPreferences } from '@/services/settings.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'
import { useState } from 'react'

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={onChange}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
      'transition-colors duration-200 focus:outline-none',
      checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700',
    )}
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200',
        checked ? 'translate-x-4' : 'translate-x-0',
      )}
    />
  </button>
)

// ── Notification row ──────────────────────────────────────────────────────────
const NotifRow = ({
  label,
  description,
  emailKey,
  inappKey,
  prefs,
  onToggle,
  showEmail = true,
}: {
  label: string
  description?: string
  emailKey?: keyof NotificationPreferences
  inappKey?: keyof NotificationPreferences
  prefs: NotificationPreferences
  onToggle: (key: keyof NotificationPreferences) => void
  showEmail?: boolean
}) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-700 last:border-0 gap-4">
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-800 dark:text-white">{label}</p>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
    </div>
    <div className="flex items-center gap-5 shrink-0">
      {showEmail && emailKey && (
        <div className="flex items-center gap-2">
          <Mail size={13} className="text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400 w-10">Email</span>
          <Toggle checked={prefs[emailKey] as boolean} onChange={() => onToggle(emailKey)} />
        </div>
      )}
      {inappKey && (
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12">In-App</span>
          <Toggle checked={prefs[inappKey] as boolean} onChange={() => onToggle(inappKey)} />
        </div>
      )}
    </div>
  </div>
)

const defaultPrefs = (): NotificationPreferences => ({
  leave_approved_email:                 true,
  leave_approved_inapp:                 true,
  leave_rejected_email:                 true,
  leave_rejected_inapp:                 true,
  task_assigned_email:                  true,
  task_assigned_inapp:                  true,
  payslip_ready_email:                  true,
  payslip_ready_inapp:                  true,
  attendance_regularization_inapp:      true,
  checkin_reminder_inapp:               true,
  checkout_reminder_inapp:              true,
  project_deadline_email:               true,
  project_deadline_inapp:               true,
  birthday_reminder_inapp:              false,
})

const NotificationSettings = () => {
  const queryClient = useQueryClient()
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs())

  const { data, isLoading } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: settingsService.getNotificationPreferences,
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (data) setPrefs(data)
  }, [data])

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => settingsService.updateNotificationPreferences(prefs),
    onSuccess: () => {
      toast.success('Notification preferences saved!')
      queryClient.invalidateQueries({ queryKey: ['notification-prefs'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Save failed'),
  })

  const toggle = (key: keyof NotificationPreferences) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
  }

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-2xl">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Notification Preferences</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          Choose how and when you want to be notified. Changes apply to your account only.
        </p>
      </div>

      {/* ── Leave ─────────────────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Leave</p>
        <NotifRow
          label="Leave Approved"
          description="When your leave request is approved by a manager."
          emailKey="leave_approved_email"
          inappKey="leave_approved_inapp"
          prefs={prefs}
          onToggle={toggle}
        />
        <NotifRow
          label="Leave Rejected"
          description="When your leave request is declined."
          emailKey="leave_rejected_email"
          inappKey="leave_rejected_inapp"
          prefs={prefs}
          onToggle={toggle}
        />
      </div>

      {/* ── Tasks & Projects ──────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Tasks &amp; Projects</p>
        <NotifRow
          label="New Task Assigned"
          description="When a task is assigned to you."
          emailKey="task_assigned_email"
          inappKey="task_assigned_inapp"
          prefs={prefs}
          onToggle={toggle}
        />
        <NotifRow
          label="Project Deadline Approaching"
          description="7 days before a project you're part of is due."
          emailKey="project_deadline_email"
          inappKey="project_deadline_inapp"
          prefs={prefs}
          onToggle={toggle}
        />
      </div>

      {/* ── Payroll ───────────────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Payroll</p>
        <NotifRow
          label="Payslip Ready"
          description="When your monthly payslip is generated."
          emailKey="payslip_ready_email"
          inappKey="payslip_ready_inapp"
          prefs={prefs}
          onToggle={toggle}
        />
      </div>

      {/* ── Attendance ────────────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Attendance</p>
        <NotifRow
          label="Attendance Regularization Approved"
          description="When your regularization request is reviewed."
          inappKey="attendance_regularization_inapp"
          prefs={prefs}
          onToggle={toggle}
          showEmail={false}
        />
        <NotifRow
          label="Check-in Reminder"
          description="Daily reminder to mark your attendance at check-in time."
          inappKey="checkin_reminder_inapp"
          prefs={prefs}
          onToggle={toggle}
          showEmail={false}
        />
        <NotifRow
          label="Check-out Reminder"
          description="Daily reminder to check out at the end of your shift."
          inappKey="checkout_reminder_inapp"
          prefs={prefs}
          onToggle={toggle}
          showEmail={false}
        />
      </div>

      {/* ── Misc ──────────────────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Miscellaneous</p>
        <NotifRow
          label="Birthday Reminders"
          description="In-app reminder on teammates' birthdays."
          inappKey="birthday_reminder_inapp"
          prefs={prefs}
          onToggle={toggle}
          showEmail={false}
        />
      </div>

      <div className="flex justify-end">
        <Button loading={saving} onClick={() => save()}>
          Save Preferences
        </Button>
      </div>
    </div>
  )
}

export default NotificationSettings
