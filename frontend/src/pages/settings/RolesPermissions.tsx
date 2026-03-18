import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'

import { settingsService } from '@/services/settings.service'
import type { PermissionModule, PermissionAction, ModulePermissions, RolePermissionMap } from '@/services/settings.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const ROLES_LIST = [
  { id: 'super_admin',      label: 'Super Admin',     color: 'bg-purple-100 text-purple-700' },
  { id: 'admin',            label: 'Admin',           color: 'bg-blue-100 text-blue-700' },
  { id: 'hr',               label: 'HR',              color: 'bg-pink-100 text-pink-700' },
  { id: 'finance_manager',  label: 'Finance Manager', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'project_manager',  label: 'Project Manager', color: 'bg-orange-100 text-orange-700' },
  { id: 'team_lead',        label: 'Team Lead',       color: 'bg-cyan-100 text-cyan-700' },
  { id: 'manager',          label: 'Manager',         color: 'bg-amber-100 text-amber-700' },
  { id: 'employee',         label: 'Employee',        color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' },
]

const MODULES: PermissionModule[] = [
  'attendance', 'leave', 'projects', 'tasks', 'staff', 'payroll', 'reports', 'settings',
]

const MODULE_LABELS: Record<PermissionModule, string> = {
  attendance: 'Attendance',
  leave:      'Leave',
  projects:   'Projects',
  tasks:      'Tasks',
  staff:      'Staff',
  payroll:    'Payroll',
  reports:    'Reports',
  settings:   'Settings',
}

const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve']

const ACTION_LABELS: Record<PermissionAction, string> = {
  view:    'View',
  create:  'Create',
  edit:    'Edit',
  delete:  'Delete',
  approve: 'Approve',
}

const emptyPermissions = (): RolePermissionMap =>
  Object.fromEntries(
    MODULES.map((m) => [
      m,
      Object.fromEntries(ACTIONS.map((a) => [a, false])) as ModulePermissions,
    ]),
  ) as RolePermissionMap

// ── Checkbox toggle ───────────────────────────────────────────────────────────
const PermCheckbox = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={cn(
      'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
      checked
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400',
      disabled && 'opacity-40 cursor-not-allowed',
    )}
  >
    {checked && (
      <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
        <path d="M1 5l3.5 4L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
)

const RolesPermissions = () => {
  const [selectedRole, setSelectedRole] = useState('admin')
  const [permissions,  setPermissions]  = useState<RolePermissionMap>(emptyPermissions())

  const { data, isLoading } = useQuery({
    queryKey: ['role-permissions', selectedRole],
    queryFn: () => settingsService.getRolePermissions(selectedRole),
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (data?.permissions) setPermissions(data.permissions)
    else setPermissions(emptyPermissions())
  }, [data, selectedRole])

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => settingsService.updateRolePermissions(selectedRole, permissions),
    onSuccess: () => toast.success(`Permissions saved for ${selectedRole}`),
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Save failed'),
  })

  const togglePerm = (module: PermissionModule, action: PermissionAction) => {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action],
      },
    }))
  }

  const toggleRow = (module: PermissionModule) => {
    const allOn = ACTIONS.every((a) => permissions[module][a])
    setPermissions((prev) => ({
      ...prev,
      [module]: Object.fromEntries(ACTIONS.map((a) => [a, !allOn])) as ModulePermissions,
    }))
  }

  const toggleColumn = (action: PermissionAction) => {
    const allOn = MODULES.every((m) => permissions[m][action])
    setPermissions((prev) => {
      const next = { ...prev }
      MODULES.forEach((m) => {
        next[m] = { ...next[m], [action]: !allOn }
      })
      return next
    })
  }

  const isSuperAdmin = selectedRole === 'super_admin'

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <ShieldCheck size={16} className="text-blue-600 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Roles &amp; Permissions</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Configure what each role can do across modules. Select a role on the left, then toggle permissions.
          </p>
        </div>
      </div>

      <div className="flex gap-5 min-h-[480px]">
        {/* ── Role list ─────────────────────────────────────────── */}
        <div className="w-44 shrink-0 space-y-1">
          {ROLES_LIST.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                selectedRole === role.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
              )}
            >
              {role.label}
            </button>
          ))}
        </div>

        {/* ── Permission matrix ────────────────────────────────── */}
        <div className="flex-1 card overflow-hidden">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {isSuperAdmin && (
                <div className="px-4 py-3 bg-purple-50 dark:bg-purple-950 border-b border-purple-100 dark:border-purple-800">
                  <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                    Super Admin has full access to all modules. Changes here are cosmetic only.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-32">Module</th>
                      {ACTIONS.map((action) => (
                        <th
                          key={action}
                          className="px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-center cursor-pointer
                            hover:text-blue-600 select-none"
                          onClick={() => !isSuperAdmin && toggleColumn(action)}
                        >
                          {ACTION_LABELS[action]}
                          <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 font-normal">
                            {!isSuperAdmin ? '(toggle all)' : ''}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {MODULES.map((module) => {
                      const rowAllOn = ACTIONS.every((a) => permissions[module]?.[a])
                      return (
                        <tr key={module} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <td
                            className="px-4 py-3 font-medium text-gray-800 dark:text-white cursor-pointer select-none hover:text-blue-600"
                            onClick={() => !isSuperAdmin && toggleRow(module)}
                            title={!isSuperAdmin ? 'Click to toggle all permissions for this module' : ''}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  rowAllOn ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
                                )}
                              />
                              {MODULE_LABELS[module]}
                            </div>
                          </td>
                          {ACTIONS.map((action) => (
                            <td key={action} className="px-3 py-3 text-center">
                              <div className="flex justify-center">
                                <PermCheckbox
                                  checked={isSuperAdmin || (permissions[module]?.[action] ?? false)}
                                  onChange={() => togglePerm(module, action)}
                                  disabled={isSuperAdmin}
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Click a module name or column header to toggle all checkboxes in that row/column.
                </p>
                <Button
                  size="sm"
                  loading={saving}
                  disabled={isSuperAdmin}
                  onClick={() => save()}
                >
                  Save Permissions
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default RolesPermissions
