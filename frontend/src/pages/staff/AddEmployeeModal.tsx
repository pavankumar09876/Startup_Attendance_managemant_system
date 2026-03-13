import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react'

import { staffService } from '@/services/staff.service'
import type { EmploymentType, WorkLocation } from '@/types/user.types'
import { ROLES, ROLE_LABELS } from '@/constants/roles'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

// ── Schema ─────────────────────────────────────────────────────────────────────
const schema = z.object({
  // Step 1
  first_name:  z.string().min(2, 'First name required'),
  last_name:   z.string().min(1, 'Last name required'),
  email:       z.string().email('Valid email required'),
  phone:       z.string().optional(),
  date_of_birth: z.string().optional(),
  // Step 2
  employee_id:     z.string().min(1, 'Employee ID required'),
  department_id:   z.string().optional(),
  designation:     z.string().optional(),
  manager_id:      z.string().optional(),
  date_of_joining: z.string().min(1, 'Joining date required'),
  employment_type: z.string() as z.ZodType<EmploymentType>,
  work_location:   z.string() as z.ZodType<WorkLocation>,
  // Step 3
  salary:      z.coerce.number().min(0).optional(),
  hra:         z.coerce.number().min(0).optional(),
  allowances:  z.coerce.number().min(0).optional(),
  bank_account: z.string().optional(),
  ifsc_code:    z.string().optional(),
  // Step 4
  role:                z.nativeEnum(ROLES),
  password:            z.string().min(8, 'Min 8 characters'),
  send_welcome_email:  z.boolean().optional(),
})

type FormData = z.infer<typeof schema>

const STEP_LABELS = ['Personal', 'Employment', 'Salary', 'Access']
const today = new Date().toISOString().split('T')[0]

// ── Step indicator ─────────────────────────────────────────────────────────────
const StepIndicator = ({ current }: { current: number }) => (
  <div className="flex items-center gap-2 mb-6">
    {STEP_LABELS.map((label, i) => {
      const s = i + 1
      return (
        <div key={s} className="flex items-center gap-1.5">
          <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0',
            current >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
          )}>
            {current > s ? <CheckCircle2 size={13} /> : s}
          </div>
          <span className={cn(
            'text-xs font-medium hidden sm:block',
            current >= s ? 'text-blue-600' : 'text-gray-400',
          )}>
            {label}
          </span>
          {s < STEP_LABELS.length && (
            <div className={cn(
              'w-4 h-px mx-1',
              current > s ? 'bg-blue-400' : 'bg-gray-200',
            )} />
          )}
        </div>
      )
    })}
  </div>
)

// ── Field wrapper ──────────────────────────────────────────────────────────────
const Field = ({
  label, error, required = false, children,
}: {
  label: string; error?: string; required?: boolean; children: React.ReactNode
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
)

const inputCls = (err?: string) => cn(
  'w-full px-3 py-2.5 rounded-lg border text-sm',
  'focus:outline-none focus:ring-2 focus:ring-blue-500',
  err ? 'border-red-400' : 'border-gray-300',
)

// ── Main ───────────────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void }

const AddEmployeeModal = ({ open, onClose }: Props) => {
  const [step, setStep]           = useState<1 | 2 | 3 | 4>(1)
  const [sendWelcome, setSendWelcome] = useState(true)
  const queryClient               = useQueryClient()

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: staffService.getDepartments,
  })

  const { data: managers = [] } = useQuery({
    queryKey: ['users', 'managers'],
    queryFn: () => staffService.getEmployees({ role: ROLES.MANAGER, limit: 100 }),
    select: (d) => d.users ?? [],
  })

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      employment_type: 'full_time',
      work_location:   'office',
      role:            ROLES.EMPLOYEE,
      send_welcome_email: true,
    },
  })

  // Auto-generate employee ID on mount
  useEffect(() => {
    if (open) {
      staffService.generateEmployeeId()
        .then((r) => setValue('employee_id', r.employee_id))
        .catch(() => setValue('employee_id', `EMP${Date.now().toString().slice(-4)}`))
    }
  }, [open, setValue])

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      staffService.createEmployee({ ...data, send_welcome_email: sendWelcome }),
    onSuccess: () => {
      toast.success('Employee added!')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      handleClose()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Failed to add employee'),
  })

  const handleClose = () => { reset(); setStep(1); onClose() }

  const goNext = handleSubmit(() => setStep((s) => (s < 4 ? (s + 1) as any : s))  )
  const onSubmit = handleSubmit((data) => mutate(data))

  const employmentTypes: { value: EmploymentType; label: string }[] = [
    { value: 'full_time', label: 'Full-time' },
    { value: 'part_time', label: 'Part-time' },
    { value: 'contract',  label: 'Contract' },
    { value: 'intern',    label: 'Intern' },
  ]
  const workLocations: { value: WorkLocation; label: string }[] = [
    { value: 'office', label: 'Office' },
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
  ]

  return (
    <Modal open={open} onClose={handleClose} title="Add New Employee" size="md">
      <StepIndicator current={step} />

      {/* ── Step 1: Personal ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required error={errors.first_name?.message}>
              <input {...register('first_name')} placeholder="John" className={inputCls(errors.first_name?.message)} />
            </Field>
            <Field label="Last Name" required error={errors.last_name?.message}>
              <input {...register('last_name')} placeholder="Doe" className={inputCls(errors.last_name?.message)} />
            </Field>
          </div>
          <Field label="Email" required error={errors.email?.message}>
            <input type="email" {...register('email')} placeholder="john@company.com" className={inputCls(errors.email?.message)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input {...register('phone')} placeholder="+91 9876543210" className={inputCls()} />
            </Field>
            <Field label="Date of Birth">
              <input type="date" max={today} {...register('date_of_birth')} className={inputCls()} />
            </Field>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button className="flex-1" rightIcon={<ArrowRight size={14} />} onClick={goNext}>Next</Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Employment ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee ID" required error={errors.employee_id?.message}>
              <div className="relative">
                <input {...register('employee_id')} className={inputCls(errors.employee_id?.message)} />
                <button
                  type="button"
                  onClick={() =>
                    staffService.generateEmployeeId()
                      .then((r) => setValue('employee_id', r.employee_id))
                      .catch(() => {})
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                  title="Regenerate"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </Field>
            <Field label="Joining Date" required error={errors.date_of_joining?.message}>
              <input type="date" {...register('date_of_joining')} className={inputCls(errors.date_of_joining?.message)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select {...register('department_id')} className={inputCls()}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Designation">
              <input {...register('designation')} placeholder="e.g. Senior Developer" className={inputCls()} />
            </Field>
          </div>
          <Field label="Reporting Manager">
            <select {...register('manager_id')} className={inputCls()}>
              <option value="">None</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? `${m.first_name} ${m.last_name}`}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employment Type">
              <select {...register('employment_type')} className={inputCls()}>
                {employmentTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Work Location">
              <select {...register('work_location')} className={inputCls()}>
                {workLocations.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" leftIcon={<ArrowLeft size={14} />} onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" rightIcon={<ArrowRight size={14} />} onClick={goNext}>Next</Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Salary ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'salary' as const,     label: 'Basic Salary (₹)' },
              { name: 'hra' as const,        label: 'HRA (₹)' },
              { name: 'allowances' as const, label: 'Allowances (₹)' },
            ].map(({ name, label }) => (
              <Field key={name} label={label}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    {...register(name)}
                    placeholder="0"
                    className="w-full pl-6 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </Field>
            ))}
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700">
            Gross salary: ₹{(
              (Number(watch('salary') ?? 0) +
               Number(watch('hra') ?? 0) +
               Number(watch('allowances') ?? 0))
              .toLocaleString('en-IN')
            )} / month
          </div>
          <Field label="Bank Account Number">
            <input {...register('bank_account')} placeholder="XXXX XXXX XXXX XXXX" className={inputCls()} />
          </Field>
          <Field label="IFSC Code">
            <input {...register('ifsc_code')} placeholder="e.g. HDFC0001234" className={cn(inputCls(), 'uppercase')} />
          </Field>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" leftIcon={<ArrowLeft size={14} />} onClick={() => setStep(2)}>Back</Button>
            <Button className="flex-1" rightIcon={<ArrowRight size={14} />} onClick={goNext}>Next</Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Access ── */}
      {step === 4 && (
        <div className="space-y-4">
          <Field label="System Role" required>
            <div className="grid grid-cols-2 gap-2">
              {(Object.values(ROLES) as ROLES[]).map((r) => (
                <label key={r} className="cursor-pointer">
                  <input type="radio" value={r} className="sr-only" {...register('role')} />
                  <div className={cn(
                    'px-3 py-2.5 rounded-lg border text-sm font-medium transition-all',
                    watch('role') === r
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  )}>
                    {ROLE_LABELS[r]}
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Temporary Password" required error={errors.password?.message}>
            <input
              type="password"
              {...register('password')}
              placeholder="Min 8 characters"
              className={inputCls(errors.password?.message)}
            />
          </Field>

          {/* Send welcome email toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-800">Send welcome email</p>
              <p className="text-xs text-gray-500">Email login credentials to employee</p>
            </div>
            <button
              type="button"
              onClick={() => setSendWelcome((v) => !v)}
              className={cn(
                'relative inline-flex w-10 h-5 rounded-full transition-colors',
                sendWelcome ? 'bg-blue-600' : 'bg-gray-200',
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                sendWelcome ? 'translate-x-5' : 'translate-x-0',
              )} />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" leftIcon={<ArrowLeft size={14} />} onClick={() => setStep(3)} disabled={isPending}>Back</Button>
            <Button className="flex-1" loading={isPending} onClick={onSubmit}>Add Employee</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default AddEmployeeModal
