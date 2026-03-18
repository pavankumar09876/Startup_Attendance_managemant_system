import { useState, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Upload, X, Image } from 'lucide-react'

import { payrollService } from '@/services/payroll.service'
import { projectService } from '@/services/project.service'
import type { CreateExpensePayload } from '@/types/payroll.types'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import DatePicker from '@/components/common/DatePicker'
import { cn } from '@/utils/cn'

const schema = z.object({
  title:      z.string().min(2, 'Title required'),
  category:   z.enum(['travel', 'meals', 'equipment', 'other']),
  amount:     z.coerce.number().min(1, 'Amount must be > 0'),
  date:       z.string().min(1, 'Date required'),
  project_id: z.string().optional(),
  notes:      z.string().optional(),
})

type FormData = z.infer<typeof schema>

const inputCls = cn(
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm',
  'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
  'placeholder-gray-400 dark:placeholder-gray-500',
  'focus:outline-none focus:ring-2 focus:ring-blue-500',
)

const CATEGORIES: { value: FormData['category']; label: string; color: string }[] = [
  { value: 'travel',    label: 'Travel',    color: 'bg-blue-100 text-blue-700' },
  { value: 'meals',     label: 'Meals',     color: 'bg-green-100 text-green-700' },
  { value: 'equipment', label: 'Equipment', color: 'bg-purple-100 text-purple-700' },
  { value: 'other',     label: 'Other',     color: 'bg-gray-100 text-gray-700' },
]

interface Props { open: boolean; onClose: () => void }

const SubmitExpenseModal = ({ open, onClose }: Props) => {
  const queryClient = useQueryClient()
  const [receipt, setReceipt]       = useState<File | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => projectService.list().then((d: any) => (Array.isArray(d) ? d : d.projects ?? [])),
    staleTime: 1000 * 60 * 5,
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'travel',
      date: new Date().toISOString().slice(0, 10),
    },
  })

  const selectedCategory = watch('category')

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const expense = await payrollService.submitExpense(data as CreateExpensePayload)
      if (receipt) {
        await payrollService.uploadReceipt(expense.id, receipt)
      }
      return expense
    },
    onSuccess: () => {
      toast.success('Expense submitted!')
      queryClient.invalidateQueries({ queryKey: ['my-expenses'] })
      reset()
      setReceipt(null)
      setPreview(null)
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Submit failed'),
  })

  const handleFile = (file: File) => {
    setReceipt(file)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <Modal open={open} onClose={onClose} title="Submit Expense" size="md">
      <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Title</label>
          <input {...register('title')} placeholder="e.g. Client dinner" className={inputCls} />
          {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title.message}</p>}
        </div>

        {/* Category pills */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Category</label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setValue('category', c.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all',
                  selectedCategory === c.value
                    ? `${c.color} border-current`
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs">₹</span>
              <input
                type="number"
                min="1"
                step="0.01"
                {...register('amount')}
                className={cn(inputCls, 'pl-6')}
              />
            </div>
            {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date</label>
            <Controller name="date" control={control} render={({ field }) => (
              <DatePicker value={field.value ?? ''} onChange={field.onChange} error={!!errors.date} placeholder="Select date" />
            )} />
            {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date.message}</p>}
          </div>
        </div>

        {/* Project */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Project (optional)</label>
          <select {...register('project_id')} className={inputCls}>
            <option value="">No project</option>
            {projects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Receipt upload */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Receipt</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {preview ? (
            <div className="relative">
              <img src={preview} alt="Receipt" className="w-full max-h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
              <button
                type="button"
                onClick={() => { setReceipt(null); setPreview(null) }}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-5 border-2 border-dashed border-gray-300 dark:border-gray-600
                rounded-lg text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Upload size={20} />
              <span className="text-xs">Click to upload image or PDF</span>
            </button>
          )}
          {receipt && !preview && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-600 dark:text-gray-300">
              <Image size={12} />
              {receipt.name}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes (optional)</label>
          <textarea
            rows={2}
            {...register('notes')}
            placeholder="Additional context…"
            className={cn(inputCls, 'resize-none')}
          />
        </div>

        <div className="flex gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isPending}>
            Submit Expense
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default SubmitExpenseModal
