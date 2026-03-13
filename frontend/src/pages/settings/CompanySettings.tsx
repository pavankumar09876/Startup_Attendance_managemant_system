import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, Upload } from 'lucide-react'

import { settingsService } from '@/services/settings.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Kathmandu',
  'Asia/Karachi', 'Asia/Dubai', 'Europe/London', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Australia/Sydney', 'Pacific/Auckland',
]

const INDUSTRIES = [
  'Information Technology', 'Finance & Banking', 'Healthcare', 'Education',
  'Manufacturing', 'Retail', 'Hospitality', 'Media & Entertainment',
  'Real Estate', 'Consulting', 'Other',
]

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const schema = z.object({
  name:           z.string().min(2, 'Required'),
  industry:       z.string().optional(),
  size:           z.string().optional(),
  founded_year:   z.coerce.number().min(1800).max(new Date().getFullYear()).optional().or(z.literal('')),
  address:        z.string().optional(),
  city:           z.string().optional(),
  state:          z.string().optional(),
  country:        z.string().optional(),
  timezone:       z.string().min(1, 'Required'),
  working_days:   z.array(z.number()),
  work_start_time: z.string().min(1),
  work_end_time:   z.string().min(1),
})

type FormData = z.infer<typeof schema>

const inputCls = cn(
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-blue-500',
)

const CompanySettings = () => {
  const queryClient = useQueryClient()
  const fileRef     = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['settings-company'],
    queryFn: settingsService.getCompanySettings,
    staleTime: 1000 * 60 * 5,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      timezone:        'Asia/Kolkata',
      working_days:    [0, 1, 2, 3, 4],
      work_start_time: '09:00',
      work_end_time:   '18:00',
    },
  })

  useEffect(() => {
    if (data) {
      reset({
        name:            data.name,
        industry:        data.industry         ?? '',
        size:            data.size             ?? '',
        founded_year:    data.founded_year     ?? '',
        address:         data.address          ?? '',
        city:            data.city             ?? '',
        state:           data.state            ?? '',
        country:         data.country          ?? '',
        timezone:        data.timezone         ?? 'Asia/Kolkata',
        working_days:    data.working_days      ?? [0, 1, 2, 3, 4],
        work_start_time: data.work_start_time  ?? '09:00',
        work_end_time:   data.work_end_time    ?? '18:00',
      })
    }
  }, [data, reset])

  const { mutate: uploadLogo, isPending: uploadingLogo } = useMutation({
    mutationFn: (file: File) => settingsService.uploadCompanyLogo(file),
    onSuccess: () => {
      toast.success('Logo updated!')
      queryClient.invalidateQueries({ queryKey: ['settings-company'] })
    },
    onError: () => toast.error('Logo upload failed'),
  })

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (payload: FormData) => settingsService.updateCompanySettings(payload as any),
    onSuccess: () => {
      toast.success('Company settings saved!')
      queryClient.invalidateQueries({ queryKey: ['settings-company'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Save failed'),
  })

  const workingDays = watch('working_days') ?? []

  const toggleDay = (day: number) => {
    const curr = workingDays
    setValue(
      'working_days',
      curr.includes(day) ? curr.filter((d) => d !== day) : [...curr, day].sort(),
      { shouldDirty: true },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((d) => save(d))} className="space-y-8 max-w-2xl">
      {/* ── Logo ────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Company Logo</h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
            {data?.logo_url ? (
              <img src={data.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Building2 size={24} className="text-gray-300" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Upload size={13} />}
            loading={uploadingLogo}
            onClick={() => fileRef.current?.click()}
          >
            Upload Logo
          </Button>
          <p className="text-xs text-gray-400">PNG, SVG recommended. Max 1MB.</p>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Company info ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Company Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
            <input {...register('name')} className={inputCls} />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
            <select {...register('industry')} className={inputCls}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Company Size</label>
            <select {...register('size')} className={inputCls}>
              <option value="">Select size</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Founded Year</label>
            <input type="number" min="1800" max={new Date().getFullYear()} {...register('founded_year')} className={inputCls} />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Address ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Address</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
            <input {...register('address')} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input {...register('city')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
              <input {...register('state')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
              <input {...register('country')} className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Work schedule ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Work Schedule</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Timezone *</label>
            <select {...register('timezone')} className={cn(inputCls, 'max-w-xs')}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Working Days</label>
            <div className="flex gap-2">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    'w-10 h-10 rounded-lg text-xs font-semibold border-2 transition-all',
                    workingDays.includes(i)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Work Start Time</label>
              <input type="time" {...register('work_start_time')} className={cn(inputCls, 'w-36')} />
            </div>
            <div className="text-gray-400 text-sm mt-5">to</div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Work End Time</label>
              <input type="time" {...register('work_end_time')} className={cn(inputCls, 'w-36')} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <Button type="submit" loading={saving}>
          Save Company Settings
        </Button>
      </div>
    </form>
  )
}

export default CompanySettings
