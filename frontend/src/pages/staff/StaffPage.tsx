import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Search, LayoutGrid, List, Users, Building2, GitBranch,
  Mail, Phone, MapPin, Calendar, ChevronRight, UserCheck, UserX, Filter, Shield, HeartPulse,
} from 'lucide-react'

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
import BulkImportModal from './BulkImportModal'
import OrgChart from './OrgChart'

type PageTab  = 'employees' | 'managers' | 'hr' | 'admin' | 'departments' | 'org-chart'
type ViewMode = 'grid' | 'list'

// ── Stat Card ───────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string
}) => (
  <div className="card px-4 py-3 flex items-center gap-3">
    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
      {icon}
    </div>
    <div>
      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  </div>
)

// ── Employee Card ───────────────────────────────────────────────────────────────
const EmployeeCard = ({
  employee, onClick, onEdit,
}: {
  employee: User
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}) => {
  const fullName = employee.full_name ?? `${employee.first_name} ${employee.last_name}`
  return (
    <div
      onClick={onClick}
      className="card p-0 cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group overflow-hidden"
    >
      {/* Colored top strip based on role */}
      <div className={cn(
        'h-1',
        employee.role === 'super_admin' ? 'bg-purple-500' :
        employee.role === 'admin' ? 'bg-blue-500' :
        employee.role === 'hr' ? 'bg-pink-500' :
        employee.role === 'manager' ? 'bg-amber-500' :
        'bg-gray-300 dark:bg-gray-600',
      )} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <Avatar name={fullName} src={employee.avatar_url} size="lg" />
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900',
              employee.is_active ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500',
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
              {fullName}
            </h3>
            {employee.designation && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {employee.designation}
              </p>
            )}
            <div className="mt-1.5">
              <Badge label={ROLE_LABELS[employee.role]} className={ROLE_COLORS[employee.role]} />
            </div>
          </div>
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 dark:text-gray-500
              hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-all text-xs flex-shrink-0"
          >
            Edit
          </button>
        </div>

        {/* Info section */}
        <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 truncate">
            <Mail size={11} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
            {employee.email}
          </p>
          {employee.department_name && (
            <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Building2 size={11} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
              {employee.department_name}
            </p>
          )}
          <p className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="font-mono text-[10px]">{employee.employee_id}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Employee Row ────────────────────────────────────────────────────────────────
const EmployeeRow = ({
  employee, onClick, onEdit,
}: {
  employee: User
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}) => {
  const fullName = employee.full_name ?? `${employee.first_name} ${employee.last_name}`
  return (
    <tr onClick={onClick} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Avatar name={fullName} src={employee.avatar_url} size="sm" />
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-white dark:border-gray-900',
              employee.is_active ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500',
            )} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{fullName}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{employee.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{employee.employee_id}</td>
      <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">{employee.department_name ?? '—'}</td>
      <td className="px-4 py-3.5">
        <Badge label={ROLE_LABELS[employee.role]} className={ROLE_COLORS[employee.role]} />
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">
        {employee.designation ?? '—'}
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{employee.manager_name ?? '—'}</td>
      <td className="px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {employee.date_of_joining ? formatDate(employee.date_of_joining, 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-4 py-3.5">
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          employee.is_active
            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', employee.is_active ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500')} />
          {employee.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600
            px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
        >
          Edit
        </button>
      </td>
    </tr>
  )
}

const CardSkeleton = () => (
  <div className="card p-0 overflow-hidden animate-pulse">
    <div className="h-1 bg-gray-200 dark:bg-gray-700" />
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </div>
      </div>
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1.5">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    </div>
  </div>
)

// ── Main ────────────────────────────────────────────────────────────────────────
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
  const [importOpen, setImportOpen]     = useState(false)
  const [editEmployee, setEditEmployee] = useState<User | null>(null)
  const [showFilters, setShowFilters]   = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  // Force role filter based on active tab
  const tabRole = pageTab === 'employees' ? ROLES.EMPLOYEE
    : pageTab === 'managers' ? ROLES.MANAGER
    : pageTab === 'hr' ? ROLES.HR
    : pageTab === 'admin' ? ROLES.ADMIN
    : ''
  const effectiveRole = tabRole || roleFilter || undefined

  const { data, isLoading } = useQuery({
    queryKey: ['employees', debouncedSearch, deptFilter, effectiveRole, statusFilter, pageTab],
    queryFn: () =>
      staffService.getEmployees({
        search:        debouncedSearch || undefined,
        department_id: deptFilter      || undefined,
        role:          effectiveRole,
        is_active:     statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        limit: 100,
      }),
    enabled: pageTab === 'employees' || pageTab === 'managers' || pageTab === 'hr' || pageTab === 'admin',
    staleTime: 1000 * 30,
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: staffService.getDepartments,
  })

  const employees: User[] = data?.users ?? []
  const total = data?.total ?? 0

  const stats = useMemo(() => {
    const active = employees.filter(e => e.is_active).length
    const inactive = employees.filter(e => !e.is_active).length
    const deptCount = new Set(employees.map(e => e.department_name).filter(Boolean)).size
    return { total, active, inactive, deptCount }
  }, [employees, total])

  const activeFilterCount = [deptFilter, roleFilter, statusFilter].filter(Boolean).length

  const PAGE_TABS: { id: PageTab; label: string; icon: React.ReactNode }[] = [
    { id: 'employees',   label: 'Employees',   icon: <Users size={14} /> },
    { id: 'managers',    label: 'Managers',     icon: <UserCheck size={14} /> },
    { id: 'hr',          label: 'HR',           icon: <HeartPulse size={14} /> },
    { id: 'admin',       label: 'Admins',       icon: <Shield size={14} /> },
    { id: 'departments', label: 'Departments',  icon: <Building2 size={14} /> },
    { id: 'org-chart',   label: 'Org Chart',    icon: <GitBranch size={14} /> },
  ]

  const selectCls = cn(
    'px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm',
    'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  )

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPageTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                pageTab === tab.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              {tab.icon}
              {tab.label}
              {(tab.id === 'employees' || tab.id === 'managers' || tab.id === 'hr' || tab.id === 'admin') && tab.id === pageTab && (
                <span className="ml-0.5 text-xs text-gray-400 dark:text-gray-500">({total})</span>
              )}
            </button>
          ))}
        </div>

        {(pageTab === 'employees' || pageTab === 'managers' || pageTab === 'hr' || pageTab === 'admin') && canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Add {pageTab === 'managers' ? 'Manager' : pageTab === 'hr' ? 'HR' : pageTab === 'admin' ? 'Admin' : 'Employee'}
            </Button>
          </div>
        )}
      </div>

      {pageTab === 'org-chart' ? (
        <OrgChart />
      ) : pageTab === 'departments' ? (
        <DepartmentsPage />
      ) : (pageTab === 'employees' || pageTab === 'managers' || pageTab === 'hr' || pageTab === 'admin') ? (
        <>
          {/* ── Stat Cards ───────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<Users size={16} className="text-blue-600" />}
              label="Total Employees"
              value={stats.total}
              color="bg-blue-50 dark:bg-blue-900/30"
            />
            <StatCard
              icon={<UserCheck size={16} className="text-green-600" />}
              label="Active"
              value={stats.active}
              color="bg-green-50 dark:bg-green-900/30"
            />
            <StatCard
              icon={<UserX size={16} className="text-gray-500" />}
              label="Inactive"
              value={stats.inactive}
              color="bg-gray-100 dark:bg-gray-800"
            />
            <StatCard
              icon={<Building2 size={16} className="text-purple-600" />}
              label="Departments"
              value={stats.deptCount}
              color="bg-purple-50 dark:bg-purple-900/30"
            />
          </div>

          {/* ── Search & Filters ──────────────────────────────── */}
          <div className="card p-3">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, employee ID…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm
                    bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                    placeholder-gray-400 dark:placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-900"
                />
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                  showFilters || activeFilterCount > 0
                    ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* View toggle */}
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'px-2.5 py-2 transition-colors',
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800',
                  )}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'px-2.5 py-2 transition-colors',
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800',
                  )}
                >
                  <List size={14} />
                </button>
              </div>
            </div>

            {/* Expandable filter row */}
            {showFilters && (
              <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={selectCls}>
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {!tabRole && (
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls}>
                    <option value="">All Roles</option>
                    {(Object.values(ROLES) as ROLES[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                )}
                <select value={statusFilter} onChange={(e) => setStatus(e.target.value as any)} className={selectCls}>
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setDeptFilter(''); setRoleFilter(''); setStatus('') }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-auto"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Content ───────────────────────────────────────── */}
          {isLoading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="card p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
                ))}
              </div>
            )
          ) : employees.length === 0 ? (
            <EmptyState
              icon={<Users size={40} className="text-gray-300" />}
              title={pageTab === 'managers' ? 'No managers found' : pageTab === 'hr' ? 'No HR staff found' : pageTab === 'admin' ? 'No admins found' : 'No employees found'}
              description={debouncedSearch ? `No results for "${debouncedSearch}".` : pageTab === 'managers' ? 'Add a manager to get started.' : pageTab === 'hr' ? 'Add HR staff to get started.' : pageTab === 'admin' ? 'Add an admin to get started.' : 'Add your first employee to get started.'}
              action={canManage ? (
                <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
                  Add Employee
                </Button>
              ) : undefined}
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      {['Employee', 'ID', 'Department', 'Role', 'Designation', 'Manager', 'Joined', 'Status', ''].map((h) => (
                        <th
                          key={h || 'actions'}
                          className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-gray-800/50"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
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
      ) : null}

      <AddEmployeeModal open={addOpen} onClose={() => setAddOpen(false)} />
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      {editEmployee && (
        <EditEmployeeModal employee={editEmployee} onClose={() => setEditEmployee(null)} />
      )}
    </div>
  )
}

export default StaffPage
