import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, LayoutGrid, List, Users, Building2 } from 'lucide-react'

import { staffService } from '@/services/staff.service'
import type { User } from '@/types/user.types'
import { ROLES, ROLE_LABELS, ROLE_COLORS } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/utils/formatDate'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'
import AddEmployeeModal from './AddEmployeeModal'
import EditEmployeeModal from './EditEmployeeModal'
import DepartmentsPage from './DepartmentsPage'

type PageTab  = 'employees' | 'departments'
type ViewMode = 'grid' | 'list'

// ── Employee Card ─────────────────────────────────────────────────────────────
const EmployeeCard = ({
  employee, onClick, onEdit,
}: {
  employee: User
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}) => {
  const fullName = employee.full_name ?? `${employee.first_name} ${employee.last_name}`
  return (
    <div onClick={onClick} className="card p-5 cursor-pointer hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <div className="relative">
          <Avatar name={fullName} src={employee.avatar_url} size="lg" />
          <span className={cn(
            'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white',
            employee.is_active ? 'bg-green-500' : 'bg-gray-400',
          )} />
        </div>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400
            hover:bg-gray-100 hover:text-gray-600 transition-all text-xs"
        >
          Edit
        </button>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 truncate mb-0.5">{fullName}</h3>
      <p className="text-xs text-gray-400 truncate mb-2">{employee.email}</p>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Badge label={ROLE_LABELS[employee.role]} className={ROLE_COLORS[employee.role]} />
      </div>
      <div className="space-y-1 text-xs text-gray-500">
        {employee.department_name && (
          <p className="flex items-center gap-1">
            <Building2 size={10} className="text-gray-400" />
            {employee.department_name}
          </p>
        )}
        {employee.designation && <p className="truncate">{employee.designation}</p>}
        <p className="text-gray-400">{employee.employee_id}</p>
      </div>
    </div>
  )
}

// ── Employee Row ──────────────────────────────────────────────────────────────
const EmployeeRow = ({
  employee, onClick, onEdit,
}: {
  employee: User
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}) => {
  const fullName = employee.full_name ?? `${employee.first_name} ${employee.last_name}`
  return (
    <tr onClick={onClick} className="hover:bg-gray-50 cursor-pointer transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar name={fullName} src={employee.avatar_url} size="sm" />
            <span className={cn(
              'absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white',
              employee.is_active ? 'bg-green-500' : 'bg-gray-400',
            )} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{fullName}</p>
            <p className="text-xs text-gray-400">{employee.employee_id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{employee.department_name ?? '—'}</td>
      <td className="px-4 py-3">
        <Badge label={ROLE_LABELS[employee.role]} className={ROLE_COLORS[employee.role]} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{employee.manager_name ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {employee.date_of_joining ? formatDate(employee.date_of_joining, 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
          employee.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', employee.is_active ? 'bg-green-500' : 'bg-gray-400')} />
          {employee.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            className="text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded-lg
              hover:bg-blue-50 transition-colors"
          >
            Edit
          </button>
        </div>
      </td>
    </tr>
  )
}

const CardSkeleton = () => (
  <div className="card p-5 space-y-3 animate-pulse">
    <div className="w-12 h-12 bg-gray-200 rounded-full" />
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-3 bg-gray-200 rounded w-1/2" />
    <div className="h-5 bg-gray-200 rounded w-16" />
  </div>
)

// ── Main ───────────────────────────────────────────────────────────────────────
const StaffPage = () => {
  const navigate = useNavigate()
  const { isAdmin, hasRole } = useAuth()
  const canManage = isAdmin || hasRole(ROLES.HR)

  const [pageTab, setPageTab]           = useState<PageTab>('employees')
  const [viewMode, setViewMode]         = useState<ViewMode>('grid')
  const [search, setSearch]             = useState('')
  const [deptFilter, setDeptFilter]     = useState('')
  const [roleFilter, setRoleFilter]     = useState('')
  const [statusFilter, setStatus]       = useState<'' | 'active' | 'inactive'>('')
  const [addOpen, setAddOpen]           = useState(false)
  const [editEmployee, setEditEmployee] = useState<User | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', debouncedSearch, deptFilter, roleFilter, statusFilter],
    queryFn: () =>
      staffService.getEmployees({
        search:        debouncedSearch || undefined,
        department_id: deptFilter      || undefined,
        role:          roleFilter      || undefined,
        is_active:     statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        limit: 100,
      }),
    staleTime: 1000 * 30,
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: staffService.getDepartments,
  })

  const employees: User[] = data?.users ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-5">
      {/* ── Page tabs ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setPageTab('employees')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              pageTab === 'employees' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Users size={14} />
            Employees
            <span className="ml-1 text-xs text-gray-400">({total})</span>
          </button>
          <button
            onClick={() => setPageTab('departments')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              pageTab === 'departments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Building2 size={14} />
            Departments
          </button>
        </div>
        {pageTab === 'employees' && canManage && (
          <Button variant="primary" leftIcon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
            Add Employee
          </Button>
        )}
      </div>

      {pageTab === 'departments' ? (
        <DepartmentsPage />
      ) : (
        <>
          {/* ── Filters ─────────────────────────────────────── */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, ID…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              {(Object.values(ROLES) as ROLES[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden ml-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('px-3 py-2 transition-colors', viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50')}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('px-3 py-2 transition-colors', viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50')}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {/* ── Content ─────────────────────────────────────── */}
          {isLoading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="card p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
                ))}
              </div>
            )
          ) : employees.length === 0 ? (
            <EmptyState
              icon={<Users size={40} className="text-gray-300" />}
              title="No employees found"
              description={debouncedSearch ? `No employees match "${debouncedSearch}".` : 'Add your first employee to get started.'}
              action={canManage ? (
                <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
                  Add Employee
                </Button>
              ) : undefined}
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {employees.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  employee={emp}
                  onClick={() => navigate(ROUTES.STAFF_DETAIL.replace(':id', emp.id))}
                  onEdit={(e) => { e.stopPropagation(); setEditEmployee(emp) }}
                />
              ))}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Employee', 'Department', 'Role', 'Manager', 'Joining Date', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map((emp) => (
                      <EmployeeRow
                        key={emp.id}
                        employee={emp}
                        onClick={() => navigate(ROUTES.STAFF_DETAIL.replace(':id', emp.id))}
                        onEdit={(e) => { e.stopPropagation(); setEditEmployee(emp) }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AddEmployeeModal open={addOpen} onClose={() => setAddOpen(false)} />
      {editEmployee && (
        <EditEmployeeModal employee={editEmployee} onClose={() => setEditEmployee(null)} />
      )}
    </div>
  )
}

export default StaffPage
