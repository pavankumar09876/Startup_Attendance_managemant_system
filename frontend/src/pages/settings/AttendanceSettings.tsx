import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertCircle } from 'lucide-react'

import { settingsService } from '@/services/settings.service'
import type { AttendanceSettings as AttendanceSettingsType } from '@/services/settings.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const schema = z.object({
  grace_period_minutes:      z.coerce.number().min(0).max(120),
  half_day_threshold_hours:  z.coerce.number().min(1).max(12),
  overtime_after_hours:      z.coerce.number().min(4).max(16),
  geofence_radius_meters:    z.coerce.number().min(0).max(10000),
  allow_wfh:                 z.boolean(),
  require_selfie:             z.boolean(),
  auto_mark_absent:           z.boolean(),
  auto_absent_after_time:     z.string(),
  checkin_reminder_time:      z.string(),
  checkout_reminder_time:     z.string(),
})

type FormData = z.infer<typeof schema>

const inputCls = cn(
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm',
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
  'focus:outline-none focus:ring-2 focus:ring-blue-500',
)

// ── Toggle switch component ───────────────────────────────────────────────────
const Toggle = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) => (
  <div className="flex items-start justify-between gap-4 py-3.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</p>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-0.5',
        checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
          'transform transition duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  </div>
)

const AttendanceSettings = () => {
  const queryClient = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingData,  setPendingData] = useState<FormData | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['settings-attendance'],
    queryFn: settingsService.getAttendanceSettings,
    staleTime: 1000 * 60 * 5,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      grace_period_minutes:     10,
      half_day_threshold_hours: 4,
      overtime_after_hours:     8,
      geofence_radius_meters:   200,
      allow_wfh:                true,
      require_selfie:           false,
      auto_mark_absent:         false,
      auto_absent_after_time:   '11:00',
      checkin_reminder_time:    '09:00',
      checkout_reminder_time:   '18:00',
    },
  })

  useEffect(() => {
    if (data) reset(data)
  }, [data, reset])

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload: FormData) => settingsService.updateAttendanceSettings(payload),
    onSuccess: () => {
      toast.success('Attendance settings saved!')
      setShowConfirm(false)
      setPendingData(null)
      queryClient.invalidateQueries({ queryKey: ['settings-attendance'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Save failed'),
  })

  const onSubmit = (data: FormData) => {
    setPendingData(data)
    setShowConfirm(true)
  }

  const gracePeriod  = watch('grace_period_minutes')
  const autoAbsent   = watch('auto_mark_absent')

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
      {/* ── Thresholds ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-5">Time Thresholds</h3>
        <div className="space-y-5">
          {/* Grace period */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Grace Period (before marked "Late")
              </label>
              <span className="text-sm font-semibold text-blue-600">{gracePeriod} min</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              {...register('grace_period_minutes')}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              <span>0 min</span><span>30 min</span><span>60 min</span>
            </div>
            {errors.grace_period_minutes && (
              <p className="text-xs text-red-500 mt-0.5">{errors.grace_period_minutes.message}</p>
            )}
          </div>

          {/* Number inputs */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Half Day Threshold (hours)
              </label>
              <input type="number" min="1" max="12" step="0.5" {...register('half_day_threshold_hours')} className={inputCls} />
              {errors.half_day_threshold_hours && (
                <p className="text-xs text-red-500 mt-0.5">{errors.half_day_threshold_hours.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Overtime Starts After (hours)
              </label>
              <input type="number" min="4" max="16" step="0.5" {...register('overtime_after_hours')} className={inputCls} />
              {errors.overtime_after_hours && (
                <p className="text-xs text-red-500 mt-0.5">{errors.overtime_after_hours.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                Geo-fence Radius (meters)
              </label>
              <input type="number" min="0" max="10000" step="10" {...register('geofence_radius_meters')} className={inputCls} />
              {errors.geofence_radius_meters && (
                <p className="text-xs text-red-500 mt-0.5">{errors.geofence_radius_meters.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700" />

      {/* ── Toggles ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Rules & Behaviour</h3>
        <Controller
          control={control}
          name="allow_wfh"
          render={({ field }) => (
            <Toggle
              checked={field.value}
              onChange={field.onChange}
              label="Allow Work from Home"
              description="Employees can mark themselves as WFH instead of checking in physically."
            />
          )}
        />
        <Controller
          control={control}
          name="require_selfie"
          render={({ field }) => (
            <Toggle
              checked={field.value}
              onChange={field.onChange}
              label="Require Selfie for Attendance"
              description="Employees must take a selfie when checking in via the mobile app."
            />
          )}
        />
        <Controller
          control={control}
          name="auto_mark_absent"
          render={({ field }) => (
            <Toggle
              checked={field.value}
              onChange={field.onChange}
              label="Auto-mark Absent if No Check-in"
              description="Automatically mark employees absent if they haven't checked in by the threshold time."
            />
          )}
        />
        {autoAbsent && (
          <div className="ml-4 pl-4 border-l-2 border-blue-200 dark:border-blue-800 py-2 mt-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Auto-absent Threshold Time</label>
            <input
              type="time"
              {...register('auto_absent_after_time')}
              className={cn(inputCls, 'w-36')}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Employees with no check-in by this time will be auto-marked absent.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-700" />

      {/* ── Reminder Times ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Reminder Notifications</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          In-app reminders are sent at these times each day (in company timezone).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Check-in Reminder Time</label>
            <input
              type="time"
              {...register('checkin_reminder_time')}
              className={cn(inputCls, 'w-full')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Check-out Reminder Time</label>
            <input
              type="time"
              {...register('checkout_reminder_time')}
              className={cn(inputCls, 'w-full')}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" loading={saving}>
          Save Attendance Settings
        </Button>
      </div>

      {/* ── Confirm dialog ───────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Confirm Changes</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">These settings affect all employees.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              Saving attendance settings will immediately affect how attendance is tracked for all employees.
              Are you sure?
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                loading={saving}
                onClick={() => pendingData && save(pendingData)}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

export default AttendanceSettings
