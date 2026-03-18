import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format, eachDayOfInterval, getDay, parseISO, isValid } from 'date-fns'
import { ArrowRight, ArrowLeft, CheckCircle2, ChevronDown } from 'lucide-react'

import { leaveService } from '@/services/leave.service'
import type { LeaveBalance, LeaveType } from '@/types/leave.types'
import { formatDate } from '@/utils/formatDate'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import DatePicker from '@/components/common/DatePicker'
import { cn } from '@/utils/cn'

// ── Leave type options ────────────────────────────────────────────────────────
const LEAVE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: 'casual',    label: 'Casual Leave' },
  { value: 'sick',      label: 'Sick Leave' },
  { value: 'earned',    label: 'Earned Leave' },
  { value: 'comp_off',  label: 'Comp-off' },
  { value: 'unpaid',    label: 'Unpaid Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
]

// Count weekdays only (Mon–Fri) between two dates
const countWeekdays = (from: string, to: string): number => {
  try {
    const start = parseISO(from)
    const end   = parseISO(to)
    if (!isValid(start) || !isValid(end) || end < start) return 0
    return eachDayOfInterval({ start, end }).filter((d) => {
      const day = getDay(d)
      return day !== 0 && day !== 6
    }).length
  } catch {
    return 0
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────
const schema = z
  .object({
    leave_type:       z.string().min(1, 'Select a leave type') as z.ZodType<LeaveType>,
    start_date:       z.string().min(1, 'Start date is required'),
    end_date:         z.string().min(1, 'End date is required'),
    reason:           z.string().min(10, 'Reason must be at least 10 characters'),
    is_half_day:      z.boolean().optional(),
    half_day_period:  z.enum(['am', 'pm']).optional(),
  })
  .refine((d) => !d.start_date || !d.end_date || d.end_date >= d.start_date, {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  })

type FormData = z.infer<typeof schema>

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  balances: LeaveBalance[]
}

const ApplyLeaveModal = ({ open, onClose, balances }: Props) => {
  const [step, setStep]         = useState<1 | 2>(1)
  const queryClient             = useQueryClient()
  const today                   = format(new Date(), 'yyyy-MM-dd')

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_half_day: false },
  })

  const watchedType       = watch('leave_type')
  const watchedStart      = watch('start_date')
  const watchedEnd        = watch('end_date')
  const watchedHalfDay    = watch('is_half_day')
  const watchedReason     = watch('reason', '')

  const dayCount = useMemo(() => {
    if (watchedHalfDay) return 0.5
    return countWeekdays(watchedStart, watchedEnd)
  }, [watchedStart, watchedEnd, watchedHalfDay])

  const selectedBalance = balances.find((b) => b.leave_type === watchedType)

  const { mutate, isPending } = useMutation({
    mutationFn: leaveService.apply,
    onSuccess: () => {
      toast.success('Leave request submitted!')
      queryClient.invalidateQueries({ queryKey: ['leaves', 'my'] })
      queryClient.invalidateQueries({ queryKey: ['leaves', 'balances'] })
      handleClose()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Submission failed'),
  })

  const handleClose = () => {
    reset()
    setStep(1)
    onClose()
  }

  const goToStep2 = handleSubmit(() => setStep(2))

  const onConfirm = handleSubmit((data) => mutate(data))

  return (
    <Modal open={open} onClose={handleClose} title="Apply for Leave" size="md">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {([1, 2] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                step >= s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
              )}
            >
              {step > s ? <CheckCircle2 size={14} /> : s}
            </div>
            <span className={`text-xs font-medium ${step >= s ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}>
              {s === 1 ? 'Details' : 'Confirm'}
            </span>
            {s < 2 && <ArrowRight size={12} className="text-gray-300 dark:text-gray-600" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Details ── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Leave type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Leave Type
            </label>
            <div className="relative">
              <select
                className={cn(
                  'w-full appearance-none px-3 py-2.5 pr-9 rounded-lg border text-sm',
                  'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  errors.leave_type ? 'border-red-400' : 'border-gray-300 dark:border-gray-600',
                )}
                {...register('leave_type')}
              >
                <option value="">Select leave type…</option>
                {LEAVE_OPTIONS.map((o) => {
                  const bal = balances.find((b) => b.leave_type === o.value)
                  return (
                    <option key={o.value} value={o.value}>
                      {o.label}{bal ? ` (${bal.remaining} days left)` : ''}
                    </option>
                  )
                })}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
            {errors.leave_type && (
              <p className="mt-1 text-xs text-red-500">{errors.leave_type.message}</p>
            )}
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">From</label>
              <Controller name="start_date" control={control} render={({ field }) => (
                <DatePicker value={field.value ?? ''} onChange={field.onChange} min={today} error={!!errors.start_date} placeholder="Start date" />
              )} />
              {errors.start_date && (
                <p className="mt-1 text-xs text-red-500">{errors.start_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">To</label>
              <Controller name="end_date" control={control} render={({ field }) => (
                <DatePicker value={field.value ?? ''} onChange={field.onChange} min={watchedStart || today} disabled={watchedHalfDay} error={!!errors.end_date} placeholder="End date" />
              )} />
              {errors.end_date && (
                <p className="mt-1 text-xs text-red-500">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          {/* Day count pill */}
          {dayCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {dayCount === 0.5 ? 'Half day' : `${dayCount} working day${dayCount > 1 ? 's' : ''}`}
              </span>
              <span className="text-xs text-blue-500 dark:text-blue-400">(weekends excluded)</span>
            </div>
          )}

          {/* Half day toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Half day leave</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Apply for only half the day</p>
            </div>
            <Controller
              name="is_half_day"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className={cn(
                    'relative inline-flex w-10 h-5 rounded-full transition-colors',
                    field.value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      field.value ? 'translate-x-5' : 'translate-x-0',
                    )}
                  />
                </button>
              )}
            />
          </div>

          {/* AM/PM selector when half day */}
          {watchedHalfDay && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Period</label>
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden w-fit">
                {(['am', 'pm'] as const).map((p) => (
                  <label key={p} className="cursor-pointer">
                    <input type="radio" value={p} className="sr-only" {...register('half_day_period')} />
                    <div className={cn(
                      'px-6 py-2 text-sm font-medium uppercase transition-colors',
                      watch('half_day_period') === p
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                    )}>
                      {p}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Reason</label>
              <span className={`text-xs ${watchedReason.length < 10 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {watchedReason.length}/10 min
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="Briefly explain the reason for your leave…"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border text-sm resize-none',
                'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                errors.reason ? 'border-red-400' : 'border-gray-300 dark:border-gray-600',
              )}
              {...register('reason')}
            />
            {errors.reason && (
              <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button className="flex-1" rightIcon={<ArrowRight size={14} />} onClick={goToStep2}>
              Next: Review
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Confirm ── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">You are applying for:</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {watchedHalfDay ? 'Half Day' : `${dayCount} day${dayCount > 1 ? 's' : ''}`}
              {' '}of{' '}
              <span className="text-blue-700 dark:text-blue-400 capitalize">
                {watchedType?.replace(/_/g, ' ')}
              </span>
            </p>
            {!watchedHalfDay ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                from{' '}
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {watchedStart ? formatDate(watchedStart, 'MMM d, yyyy') : '—'}
                </span>
                {' '}to{' '}
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {watchedEnd ? formatDate(watchedEnd, 'MMM d, yyyy') : '—'}
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                on{' '}
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {watchedStart ? formatDate(watchedStart, 'MMM d, yyyy') : '—'}
                </span>
                {' '}({watch('half_day_period')?.toUpperCase()})
              </p>
            )}
          </div>

          {/* Balance preview */}
          {selectedBalance && !watchedHalfDay && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium text-gray-800 dark:text-gray-100 capitalize">
                  {watchedType?.replace(/_/g, ' ')}
                </span>{' '}
                balance after:
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-gray-700 dark:text-gray-200">{selectedBalance.remaining} days</span>
                <ArrowRight size={13} className="text-gray-400 dark:text-gray-500" />
                <span className={selectedBalance.remaining - dayCount < 0 ? 'text-red-600' : 'text-green-600'}>
                  {selectedBalance.remaining - dayCount} days
                </span>
              </div>
            </div>
          )}

          {/* Insufficient balance warning */}
          {selectedBalance && dayCount > selectedBalance.remaining && watchedType !== 'unpaid' && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-sm text-red-700 dark:text-red-400">
              ⚠️ Insufficient balance. You only have{' '}
              <strong>{selectedBalance.remaining} days</strong> remaining.
            </div>
          )}

          {/* Reason preview */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reason</p>
            <p className="text-sm text-gray-700 dark:text-gray-200">{watch('reason')}</p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => setStep(1)}
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              loading={isPending}
              onClick={onConfirm}
            >
              Submit Request
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ApplyLeaveModal
