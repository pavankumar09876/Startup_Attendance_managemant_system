import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { staffService } from '@/services/staff.service'
import type { User, EmploymentType, WorkLocation } from '@/types/user.types'
import { ROLES, ROLE_LABELS } from '@/constants/roles'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const schema = z.object({
  first_name:      z.string().min(2, 'Required'),
  last_name:       z.string().min(1, 'Required'),
  email:           z.string().email('Valid email required'),
  phone:           z.string().optional(),
  date_of_birth:   z.string().optional(),
  address:         z.string().optional(),
  emergency_contact: z.string().optional(),
  department_id:   z.string().optional(),
  designation:     z.string().optional(),
  manager_id:      z.string().optional(),
  date_of_joining: z.string().optional(),
  employment_type: z.string().optional() as z.ZodType<EmploymentType | undefined>,
  work_location:   z.string().optional() as z.ZodType<WorkLocation | undefined>,
  role:            z.nativeEnum(ROLES),
  salary:          z.coerce.number().min(0).optional(),
  hra:             z.coerce.number().min(0).optional(),
  allowances:      z.coerce.number().min(0).optional(),
  bank_account:    z.string().optional(),
  ifsc_code:       z.string().optional(),
})

type FormData = z.infer<typeof schema>

const inputCls = cn(
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-blue-500',
)

interface Props { employee: User; onClose: () => void }

const EditEmployeeModal = ({ employee, onClose }: Props) => {
  const queryClient = useQueryClient()

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: staffService.getDepartments,
  })

  const { data: managers = [] } = useQuery({
    queryKey: ['users', 'managers'],
    queryFn: () => staffService.getEmployees({ limit: 100 }),
    select: (d) => d.users?.filter((u) => u.id !== employee.id) ?? [],
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    reset({
      first_name:       employee.first_name,
      last_name:        employee.last_name,
      email:            employee.email,
      phone:            employee.phone ?? '',
      date_of_birth:    employee.date_of_birth ?? '',
      address:          employee.address ?? '',
      emergency_contact: employee.emergency_contact ?? '',
      department_id:    employee.department_id ?? '',
      designation:      employee.designation ?? '',
      manager_id:       employee.manager_id ?? '',
      date_of_joining:  employee.date_of_joining ?? '',
      employment_type:  employee.employment_type ?? 'full_time',
      work_location:    employee.work_location ?? 'office',
      role:             employee.role,
      salary:           employee.salary,
      hra:              employee.hra,
      allowances:       employee.allowances,
      bank_account:     employee.bank_account ?? '',
      ifsc_code:        employee.ifsc_code ?? '',
    })
  }, [employee, reset])

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => staffService.updateEmployee(employee.id, data),
    onSuccess: () => {
      toast.success('Employee updated!')
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee', employee.id] })
      onClose()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Update failed'),
  })

  return (
    <Modal open onClose={onClose} title={`Edit — ${employee.first_name} ${employee.last_name}`} size="lg">
      <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-5">
        {/* Personal */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Personal Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
              <input {...register('first_name')} className={inputCls} />
              {errors.first_name && <p className="text-xs text-red-500 mt-0.5">{errors.first_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
              <input {...register('last_name')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" {...register('email')} className={inputCls} />
              {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input {...register('phone')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
              <input type="date" {...register('date_of_birth')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Contact</label>
              <input {...register('emergency_contact')} className={inputCls} />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <textarea rows={2} {...register('address')} className={cn(inputCls, 'resize-none')} />
          </div>
        </div>

        {/* Employment */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Employment</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select {...register('department_id')} className={inputCls}>
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
              <input {...register('designation')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Manager</label>
              <select {...register('manager_id')} className={inputCls}>
                <option value="">None</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? `${m.first_name} ${m.last_name}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Joining Date</label>
              <input type="date" {...register('date_of_joining')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employment Type</label>
              <select {...register('employment_type')} className={inputCls}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Work Location</label>
              <select {...register('work_location')} className={inputCls}>
                <option value="office">Office</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Role */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">System Role</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.values(ROLES) as ROLES[]).map((r) => (
              <label key={r} className="cursor-pointer">
                <input type="radio" value={r} className="sr-only" {...register('role')} />
                <div className={cn(
                  'px-3 py-2 rounded-lg border text-xs font-medium transition-all text-center',
                  employee.role === r
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300',
                )}>
                  {ROLE_LABELS[r]}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Salary */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Salary</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'salary' as const,    label: 'Basic (₹)' },
              { name: 'hra' as const,       label: 'HRA (₹)' },
              { name: 'allowances' as const, label: 'Allowances (₹)' },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                  <input type="number" min="0" {...register(name)} className={cn(inputCls, 'pl-6')} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bank Account</label>
              <input {...register('bank_account')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">IFSC Code</label>
              <input {...register('ifsc_code')} className={cn(inputCls, 'uppercase')} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1 border-t border-gray-100">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default EditEmployeeModal
