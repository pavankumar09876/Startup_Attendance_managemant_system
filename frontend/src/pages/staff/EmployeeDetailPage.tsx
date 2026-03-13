import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Edit2, Download, Briefcase,
  Calendar, FileText, CreditCard, UserCheck,
} from 'lucide-react'

import { staffService } from '@/services/staff.service'
import type { User, Payslip } from '@/types/user.types'
import type { Leave, LeaveBalance } from '@/types/leave.types'
import { ROUTES } from '@/constants/routes'
import { ROLES, ROLE_LABELS, ROLE_COLORS } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/formatDate'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'
import EditEmployeeModal from './EditEmployeeModal'

// ── Types ──────────────────────────────────────────────────────────────────────
type TabId = 'profile' | 'attendance' | 'projects' | 'leave' | 'payroll'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',    label: 'Profile',    icon: <UserCheck size={14} /> },
  { id: 'attendance', label: 'Attendance', icon: <Calendar size={14} /> },
  { id: 'projects',   label: 'Projects',   icon: <Briefcase size={14} /> },
  { id: 'leave',      label: 'Leave',      icon: <FileText size={14} /> },
  { id: 'payroll',    label: 'Payroll',    icon: <CreditCard size={14} /> },
]

// ── Info row helper ─────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-500 w-40 shrink-0">{label}</span>
    <span className="text-sm text-gray-800 text-right">{value || '—'}</span>
  </div>
)

const fmtINR = (n?: number) =>
  n != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
    : '—'

// ── Profile Tab ────────────────────────────────────────────────────────────────
const ProfileTab = ({ employee }: { employee: User }) => {
  const EMPLOYMENT_LABELS: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract:  'Contract',
    intern:    'Intern',
  }
  const LOCATION_LABELS: Record<string, string> = {
    office: 'Office',
    remote: 'Remote',
    hybrid: 'Hybrid',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Personal info */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h4>
        <InfoRow label="Email"             value={employee.email} />
        <InfoRow label="Phone"             value={employee.phone} />
        <InfoRow label="Date of Birth"     value={employee.date_of_birth ? formatDate(employee.date_of_birth, 'MMM d, yyyy') : null} />
        <InfoRow label="Address"           value={employee.address} />
        <InfoRow label="Emergency Contact" value={employee.emergency_contact} />
      </div>

      {/* Employment info */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Employment Information</h4>
        <InfoRow label="Employee ID"      value={employee.employee_id} />
        <InfoRow label="Department"       value={employee.department_name ?? employee.department?.name} />
        <InfoRow label="Role"             value={ROLE_LABELS[employee.role]} />
        <InfoRow label="Designation"      value={employee.designation} />
        <InfoRow label="Reporting Manager" value={employee.manager_name} />
        <InfoRow label="Joining Date"     value={employee.date_of_joining ? formatDate(employee.date_of_joining, 'MMM d, yyyy') : null} />
        <InfoRow label="Employment Type"  value={employee.employment_type ? EMPLOYMENT_LABELS[employee.employment_type] : null} />
        <InfoRow label="Work Location"    value={employee.work_location ? LOCATION_LABELS[employee.work_location] : null} />
      </div>
    </div>
  )
}

// ── Attendance Tab ─────────────────────────────────────────────────────────────
const AttendanceTab = ({ employeeId }: { employeeId: string }) => {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: attendance, isLoading } = useQuery({
    queryKey: ['employee-attendance', employeeId, year, month],
    queryFn: () => staffService.getEmployeeAttendance(employeeId, year, month),
  })

  const summary = (attendance as any)?.summary ?? {}

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Present',  value: summary.present ?? 0,  color: 'text-green-600' },
          { label: 'Absent',   value: summary.absent  ?? 0,  color: 'text-red-600' },
          { label: 'Late',     value: summary.late    ?? 0,  color: 'text-amber-600' },
          { label: 'WFH',      value: summary.wfh     ?? 0,  color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
      )}
    </div>
  )
}

// ── Projects Tab ───────────────────────────────────────────────────────────────
const ProjectsTab = ({ employeeId }: { employeeId: string }) => {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['employee-projects', employeeId],
    queryFn: () => staffService.getEmployeeProjects(employeeId),
  })

  const STATUS_COLORS: Record<string, string> = {
    active:     'bg-blue-100 text-blue-700',
    planning:   'bg-gray-100 text-gray-600',
    on_hold:    'bg-amber-100 text-amber-700',
    completed:  'bg-green-100 text-green-700',
  }

  if (isLoading) {
    return <div className="h-32 bg-gray-100 animate-pulse rounded-xl" />
  }

  if ((projects as any[]).length === 0) {
    return (
      <EmptyState
        icon={<Briefcase size={36} className="text-gray-300" />}
        title="No projects"
        description="Not assigned to any projects."
      />
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Project', 'Role in Project', 'Status', 'Deadline'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(projects as any[]).map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{p.role_in_project ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge
                    label={p.status?.replace(/_/g, ' ') ?? '—'}
                    className={STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}
                  />
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {p.end_date ? formatDate(p.end_date, 'MMM d, yyyy') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Leave Tab ──────────────────────────────────────────────────────────────────
const LeaveTab = ({ employeeId }: { employeeId: string }) => {
  const { data: balances = [] } = useQuery({
    queryKey: ['employee-leave-balances', employeeId],
    queryFn: () => staffService.getEmployeeLeaveBalances(employeeId),
  })

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['employee-leaves', employeeId],
    queryFn: () => staffService.getEmployeeLeaves(employeeId),
  })

  const LEAVE_COLORS: Record<string, string> = {
    casual:    'bg-blue-100 text-blue-700',
    sick:      'bg-green-100 text-green-700',
    earned:    'bg-purple-100 text-purple-700',
    comp_off:  'bg-amber-100 text-amber-700',
    unpaid:    'bg-gray-100 text-gray-600',
    maternity: 'bg-pink-100 text-pink-700',
    paternity: 'bg-cyan-100 text-cyan-700',
  }

  const STATUS_COLORS: Record<string, string> = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-5">
      {/* Balance cards */}
      {(balances as LeaveBalance[]).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(balances as LeaveBalance[]).map((b) => (
            <div key={b.leave_type} className="card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 capitalize">
                {b.leave_type.replace(/_/g, ' ')}
              </p>
              <p className="text-2xl font-bold text-gray-800">{b.remaining}</p>
              <p className="text-xs text-gray-400 mt-0.5">{b.used}/{b.total} used</p>
              <div className="w-full bg-gray-100 rounded-full h-1 mt-2">
                <div
                  className="h-1 bg-blue-500 rounded-full"
                  style={{ width: `${b.total > 0 ? (b.used / b.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leave history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700">Leave History</h4>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : (leaves as Leave[]).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No leave records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Type', 'From', 'To', 'Days', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(leaves as Leave[]).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Badge
                        label={l.leave_type.replace(/_/g, ' ')}
                        className={LEAVE_COLORS[l.leave_type] ?? 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(l.start_date, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(l.end_date, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{l.total_days}d</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={l.status}
                        className={STATUS_COLORS[l.status] ?? 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Payroll Tab ────────────────────────────────────────────────────────────────
const PayrollTab = ({ employee }: { employee: User }) => {
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['employee-payslips', employee.id],
    queryFn: () => staffService.getEmployeePayslips(employee.id),
  })

  const STATUS_COLORS: Record<string, string> = {
    paid:      'bg-green-100 text-green-700',
    processed: 'bg-blue-100 text-blue-700',
    draft:     'bg-gray-100 text-gray-600',
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const handleDownload = async (payslip: Payslip) => {
    try {
      const blob = await staffService.downloadPayslip(employee.id, payslip.id)
      const url  = URL.createObjectURL(blob as Blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `payslip-${MONTHS[payslip.month - 1]}-${payslip.year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    }
  }

  const gross = (employee.salary ?? 0) + (employee.hra ?? 0) + (employee.allowances ?? 0)
  const net   = gross - (employee.deductions ?? 0)

  return (
    <div className="space-y-5">
      {/* Salary breakdown */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Salary Structure</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Basic',      value: fmtINR(employee.salary),     color: 'text-gray-800' },
            { label: 'HRA',        value: fmtINR(employee.hra),         color: 'text-gray-800' },
            { label: 'Allowances', value: fmtINR(employee.allowances), color: 'text-gray-800' },
            { label: 'Deductions', value: fmtINR(employee.deductions), color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Net Salary (Monthly)</span>
          <span className="text-lg font-bold text-green-600">{fmtINR(net)}</span>
        </div>
        {employee.bank_account && (
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>Account: ···{employee.bank_account.slice(-4)}</span>
            {employee.ifsc_code && <span>IFSC: {employee.ifsc_code}</span>}
          </div>
        )}
      </div>

      {/* Payslip history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700">Payslip History</h4>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded" />
            ))}
          </div>
        ) : (payslips as Payslip[]).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No payslips generated yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {(payslips as Payslip[]).map((ps) => (
              <div
                key={ps.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {MONTHS[ps.month - 1]} {ps.year}
                  </p>
                  <p className="text-xs text-gray-400">Net: {fmtINR(ps.net_salary)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    label={ps.status}
                    className={STATUS_COLORS[ps.status] ?? 'bg-gray-100 text-gray-600'}
                  />
                  <button
                    onClick={() => handleDownload(ps)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800
                      px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Download size={12} />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
const EmployeeDetailPage = () => {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { isAdmin, hasRole } = useAuth()
  const canManage  = isAdmin || hasRole(ROLES.HR)
  const canPayroll = isAdmin || hasRole(ROLES.HR)
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [editOpen, setEditOpen]   = useState(false)

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => staffService.getEmployee(id!),
    enabled: !!id,
  })

  const { mutate: toggleStatus, isPending: toggling } = useMutation({
    mutationFn: (is_active: boolean) => staffService.toggleStatus(id!, is_active),
    onSuccess: () => {
      toast.success(`Employee ${employee?.is_active ? 'deactivated' : 'activated'}`)
      queryClient.invalidateQueries({ queryKey: ['employee', id] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-36 bg-gray-100 animate-pulse rounded-2xl" />
        <div className="h-64 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    )
  }

  if (!employee) {
    return (
      <EmptyState
        icon={<UserCheck size={40} className="text-gray-300" />}
        title="Employee not found"
        description="The employee you are looking for does not exist."
        action={<Button onClick={() => navigate(ROUTES.STAFF)}>Back to Staff</Button>}
      />
    )
  }

  const fullName = employee.full_name ?? `${employee.first_name} ${employee.last_name}`
  const visibleTabs = TABS.filter((t) => t.id !== 'payroll' || canPayroll)

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Back + Avatar */}
          <button
            onClick={() => navigate(ROUTES.STAFF)}
            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors self-start"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="relative">
            <Avatar name={fullName} src={employee.avatar_url} size="xl" />
            <span className={cn(
              'absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white',
              employee.is_active ? 'bg-green-500' : 'bg-gray-400',
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
                <p className="text-sm text-gray-500">{employee.employee_id}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    label={ROLE_LABELS[employee.role]}
                    className={ROLE_COLORS[employee.role]}
                  />
                  {employee.department_name && (
                    <Badge
                      label={employee.department_name}
                      className="bg-gray-100 text-gray-600"
                    />
                  )}
                  {employee.designation && (
                    <span className="text-xs text-gray-400">{employee.designation}</span>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Active toggle */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                    <span className="text-xs text-gray-600">
                      {employee.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      disabled={toggling}
                      onClick={() => toggleStatus(!employee.is_active)}
                      className={cn(
                        'relative inline-flex w-9 h-5 rounded-full transition-colors disabled:opacity-50',
                        employee.is_active ? 'bg-green-500' : 'bg-gray-300',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                        employee.is_active ? 'translate-x-4' : 'translate-x-0',
                      )} />
                    </button>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Edit2 size={13} />}
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>

            {/* Quick meta row */}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
              {employee.email && <span>{employee.email}</span>}
              {employee.phone && <span>{employee.phone}</span>}
              {employee.date_of_joining && (
                <span>Joined {formatDate(employee.date_of_joining, 'MMM d, yyyy')}</span>
              )}
              {employee.manager_name && (
                <span>Reports to: {employee.manager_name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 px-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab content ─────────────────────────────────────── */}
      {activeTab === 'profile'    && <ProfileTab employee={employee} />}
      {activeTab === 'attendance' && <AttendanceTab employeeId={id!} />}
      {activeTab === 'projects'   && <ProjectsTab employeeId={id!} />}
      {activeTab === 'leave'      && <LeaveTab employeeId={id!} />}
      {activeTab === 'payroll'    && canPayroll && <PayrollTab employee={employee} />}

      {editOpen && (
        <EditEmployeeModal employee={employee} onClose={() => setEditOpen(false)} />
      )}
    </div>
  )
}

export default EmployeeDetailPage
