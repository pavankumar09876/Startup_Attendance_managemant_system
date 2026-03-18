import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { CalendarDays, Clock } from 'lucide-react'

import { attendanceService } from '@/services/attendance.service'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import DatePicker from '@/components/common/DatePicker'

const schema = z
  .object({
    date: z.string().min(1, 'Date is required').refine(
      (d) => new Date(d) <= new Date(),
      'Cannot select a future date',
    ),
    check_in: z.string().min(1, 'Check-in time is required'),
    check_out: z.string().min(1, 'Check-out time is required'),
    reason: z.string().min(20, 'Reason must be at least 20 characters'),
  })
  .refine(
    (d) => d.check_out > d.check_in,
    { message: 'Check-out must be after check-in', path: ['check_out'] },
  )

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  prefillDate?: string
}

const RegularizationForm = ({ open, onClose, prefillDate }: Props) => {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: prefillDate ?? format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const reasonValue = watch('reason', '')

  const { mutate, isPending } = useMutation({
    mutationFn: attendanceService.submitRegularization,
    onSuccess: () => {
      toast.success('Regularization request submitted!')
      queryClient.invalidateQueries({ queryKey: ['regularizations'] })
      reset()
      onClose()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Submission failed. Please try again.'),
  })

  const onSubmit = (data: FormData) => mutate(data)

  const handleClose = () => {
    reset()
    onClose()
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <Modal open={open} onClose={handleClose} title="Regularization Request" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
            Date
          </label>
          <Controller name="date" control={control} render={({ field }) => (
            <DatePicker value={field.value ?? ''} onChange={field.onChange} max={today} error={!!errors.date} placeholder="Select date" />
          )} />
          {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date.message}</p>}
        </div>

        {/* Time pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Check-in Time
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                <Clock size={15} />
              </span>
              <input
                type="time"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${errors.check_in ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                {...register('check_in')}
              />
            </div>
            {errors.check_in && (
              <p className="mt-1 text-xs text-red-500">{errors.check_in.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Check-out Time
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                <Clock size={15} />
              </span>
              <input
                type="time"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${errors.check_out ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                {...register('check_out')}
              />
            </div>
            {errors.check_out && (
              <p className="mt-1 text-xs text-red-500">{errors.check_out.message}</p>
            )}
          </div>
        </div>

        {/* Reason */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Reason</label>
            <span className={`text-xs ${reasonValue.length < 20 ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {reasonValue.length} / 20 min
            </span>
          </div>
          <textarea
            rows={4}
            placeholder="Explain why you need this regularization (e.g. forgot to check out, system issue…)"
            className={`w-full px-3 py-2.5 rounded-lg border text-sm resize-none
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              ${errors.reason ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
            {...register('reason')}
          />
          {errors.reason && (
            <p className="mt-1 text-xs text-red-500">{errors.reason.message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isPending}
            className="flex-1"
          >
            Submit Request
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default RegularizationForm
