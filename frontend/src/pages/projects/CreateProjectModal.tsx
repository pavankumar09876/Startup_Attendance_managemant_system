import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, CheckCircle2, Search, X, UserPlus } from 'lucide-react'

import { projectService } from '@/services/project.service'
import type { ProjectPriority, ProjectStatus, ProjectRoleType } from '@/types/project.types'
import { userService } from '@/services/user.service'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Avatar from '@/components/common/Avatar'
import DatePicker from '@/components/common/DatePicker'
import { cn } from '@/utils/cn'

// ── Schema ─────────────────────────────────────────────────────────────────────
const schema = z
  .object({
    name:        z.string().min(2, 'Project name is required'),
    client_name: z.string().optional(),
    description: z.string().optional(),
    status:      z.string().min(1) as z.ZodType<ProjectStatus>,
    start_date:  z.string().min(1, 'Start date is required'),
    end_date:    z.string().min(1, 'End date is required'),
    budget:      z.coerce.number().min(0).optional(),
    priority:    z.string().min(1) as z.ZodType<ProjectPriority>,
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: 'End date must be on or after start date',
    path: ['end_date'],
  })

type FormData = z.infer<typeof schema>

interface Member { id: string; name: string; role_in_project: ProjectRoleType }

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
}

// ── Step indicator ─────────────────────────────────────────────────────────────
const STEPS = ['Details', 'Timeline & Budget', 'Team']

const StepIndicator = ({ current }: { current: number }) => (
  <div className="flex items-center gap-2 mb-6">
    {STEPS.map((label, i) => {
      const s = i + 1
      return (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
            current >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
          )}>
            {current > s ? <CheckCircle2 size={14} /> : s}
          </div>
          <span className={cn(
            'text-xs font-medium hidden sm:block',
            current >= s ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500',
          )}>
            {label}
          </span>
          {s < STEPS.length && <ArrowRight size={12} className="text-gray-300" />}
        </div>
      )
    })}
  </div>
)

// ── Main ───────────────────────────────────────────────────────────────────────
const CreateProjectModal = ({ open, onClose }: Props) => {
  const [step, setStep]         = useState<1 | 2 | 3>(1)
  const [members, setMembers]   = useState<Member[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const queryClient             = useQueryClient()
  const today                   = new Date().toISOString().split('T')[0]

  const {
    register, control, handleSubmit, watch, reset, trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'planning', priority: 'medium', start_date: '', end_date: '' },
  })

  const watchedStart = watch('start_date')

  // Search employees for team step
  const { data: employees = [] } = useQuery({
    queryKey: ['users', 'list', memberSearch],
    queryFn: () => userService.list({ search: memberSearch || undefined, limit: 20 }),
    enabled: step === 3,
    select: (d: any) => (Array.isArray(d) ? d : d.users ?? d),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      projectService.create({
        ...data,
        members: members.map((m) => ({ user_id: m.id, role: m.role_in_project })),
      }),
    onSuccess: () => {
      toast.success('Project created!')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      handleClose()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Failed to create project'),
  })

  const handleClose = () => {
    reset()
    setStep(1)
    setMembers([])
    setMemberSearch('')
    onClose()
  }

  const STEP_FIELDS: Record<number, (keyof FormData)[]> = {
    1: ['name', 'status'],
    2: ['start_date', 'end_date', 'priority'],
  }

  const goNext = async () => {
    const fields = STEP_FIELDS[step]
    const valid = fields ? await trigger(fields) : true
    if (valid) setStep((s) => (s + 1) as 1 | 2 | 3)
  }

  const onSubmit = handleSubmit((data) => mutate(data))

  const addMember = (id: string, name: string) => {
    if (members.find((m) => m.id === id)) return
    setMembers((prev) => [...prev, { id, name, role_in_project: 'contributor' }])
  }

  const removeMember = (id: string) =>
    setMembers((prev) => prev.filter((m) => m.id !== id))

  const updateMemberRole = (id: string, role: string) =>
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role_in_project: role as ProjectRoleType } : m)),
    )

  const filteredEmployees = useMemo(
    () => employees.filter((e: any) => !members.find((m) => m.id === e.id)),
    [employees, members],
  )

  return (
    <Modal open={open} onClose={handleClose} title="Create New Project" size="md">
      <StepIndicator current={step} />

      {/* ── STEP 1: Details ── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Project name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              placeholder="e.g. Website Redesign"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border text-sm',
                'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                errors.name ? 'border-red-400' : 'border-gray-300 dark:border-gray-600',
              )}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Client name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Client Name
            </label>
            <input
              {...register('client_name')}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Status
            </label>
            <select
              {...register('status')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Brief description of the project…"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm resize-none
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              rightIcon={<ArrowRight size={14} />}
              onClick={goNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Timeline & Budget ── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <Controller name="start_date" control={control} render={({ field }) => (
                <DatePicker value={field.value ?? ''} onChange={field.onChange} min={today} error={!!errors.start_date} placeholder="Start date" />
              )} />
              {errors.start_date && (
                <p className="mt-1 text-xs text-red-500">{errors.start_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <Controller name="end_date" control={control} render={({ field }) => (
                <DatePicker value={field.value ?? ''} onChange={field.onChange} min={watchedStart || today} error={!!errors.end_date} placeholder="End date" />
              )} />
              {errors.end_date && (
                <p className="mt-1 text-xs text-red-500">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as ProjectPriority[]).map((p) => (
                <label key={p} className="cursor-pointer">
                  <input type="radio" value={p} className="sr-only" {...register('priority')} />
                  <div className={cn(
                    'px-3 py-2 rounded-lg text-center text-xs font-medium border transition-all capitalize',
                    watch('priority') === p
                      ? p === 'critical' ? 'bg-red-600 text-white border-red-600'
                        : p === 'high' ? 'bg-amber-500 text-white border-amber-500'
                          : p === 'medium' ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-600 text-white border-gray-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                  )}>
                    {p}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Budget (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                {...register('budget')}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              rightIcon={<ArrowRight size={14} />}
              onClick={goNext}
            >
              Next: Team
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Team ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Search employees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
              Add Team Members
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Search results */}
          {filteredEmployees.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-36 overflow-y-auto">
              {filteredEmployees.map((emp: any) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => addMember(emp.id, emp.full_name ?? emp.email)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <Avatar name={emp.full_name ?? emp.email} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {emp.full_name ?? emp.email}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{emp.role}</p>
                  </div>
                  <UserPlus size={14} className="text-blue-500 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Added members */}
          {members.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Team ({members.length})
              </p>
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <Avatar name={m.name} size="sm" />
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {m.name}
                    </span>
                    <select
                      value={m.role_in_project}
                      onChange={(e) => updateMemberRole(m.id, e.target.value)}
                      className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1
                        bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                        focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="contributor">Contributor</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
              No members added yet — you can skip and add them later.
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => setStep(2)}
              disabled={isPending}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              loading={isPending}
              onClick={onSubmit}
            >
              Create Project
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default CreateProjectModal
