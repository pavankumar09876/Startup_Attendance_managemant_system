import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Check, X, Building2 } from 'lucide-react'

import { staffService } from '@/services/staff.service'
import type { Department } from '@/types/user.types'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/constants/roles'
import Avatar from '@/components/common/Avatar'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'

// ── Inline row editor ──────────────────────────────────────────────────────────
const EditRow = ({
  dept,
  onSave,
  onCancel,
  isSaving,
}: {
  dept?: Partial<Department>
  onSave: (payload: Partial<Department>) => void
  onCancel: () => void
  isSaving: boolean
}) => {
  const [form, setForm] = useState({
    name:        dept?.name        ?? '',
    description: dept?.description ?? '',
    type:        dept?.type        ?? 'Other' as Department['type'],
    head_id:     dept?.head_id     ?? '',
  })

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2">
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Department name"
          autoFocus
          className="w-full px-2 py-1.5 rounded-lg border border-blue-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={form.type}
          onChange={(e) => set('type', e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border border-blue-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="IT">IT</option>
          <option value="Non-IT">Non-IT</option>
          <option value="Other">Other</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Description (optional)"
          className="w-full px-2 py-1.5 rounded-lg border border-blue-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-2 text-gray-400 text-sm">—</td>
      <td className="px-4 py-2 text-gray-400 text-sm">—</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSave(form)}
            disabled={!form.name.trim() || isSaving}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white
              rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Check size={11} />
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
const DepartmentsPage = () => {
  const { isAdmin, hasRole } = useAuth()
  const canManage = isAdmin || hasRole(ROLES.HR)
  const queryClient = useQueryClient()

  const [addingNew, setAddingNew]     = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: staffService.getDepartments,
    staleTime: 1000 * 60,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['departments'] })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: (payload: Partial<Department>) => staffService.createDepartment(payload),
    onSuccess: () => { toast.success('Department created'); setAddingNew(false); invalidate() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Department> }) =>
      staffService.updateDepartment(id, payload),
    onSuccess: () => { toast.success('Department updated'); setEditingId(null); invalidate() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: deleteDept, isPending: deleting } = useMutation({
    mutationFn: (id: string) => staffService.deleteDepartment(id),
    onSuccess: () => { toast.success('Department deleted'); setDeleteConfirm(null); invalidate() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Cannot delete — employees assigned'),
  })

  const TYPE_COLORS: Record<string, string> = {
    IT:     'bg-blue-100 text-blue-700',
    'Non-IT': 'bg-purple-100 text-purple-700',
    Other:  'bg-gray-100 text-gray-600',
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900">Departments</h3>
          <p className="text-xs text-gray-500 mt-0.5">{departments.length} departments</p>
        </div>
        {canManage && !addingNew && (
          <Button
            size="sm"
            leftIcon={<Plus size={13} />}
            onClick={() => { setAddingNew(true); setEditingId(null) }}
          >
            Add Department
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Department', 'Type', 'Description', 'Head', 'Employees', canManage ? 'Actions' : ''].map((h) => h && (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Add new row */}
              {addingNew && (
                <EditRow
                  onSave={(payload) => create(payload)}
                  onCancel={() => setAddingNew(false)}
                  isSaving={creating}
                />
              )}

              {departments.length === 0 && !addingNew ? (
                <tr>
                  <td colSpan={6} className="py-8">
                    <EmptyState
                      icon={<Building2 size={32} className="text-gray-300" />}
                      title="No departments"
                      description="Create your first department."
                    />
                  </td>
                </tr>
              ) : (
                departments.map((dept) =>
                  editingId === dept.id ? (
                    <EditRow
                      key={dept.id}
                      dept={dept}
                      onSave={(payload) => update({ id: dept.id, payload })}
                      onCancel={() => setEditingId(null)}
                      isSaving={updating}
                    />
                  ) : (
                    <tr key={dept.id} className="hover:bg-gray-50 transition-colors group">
                      {/* Name */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{dept.name}</p>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        {dept.type ? (
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            TYPE_COLORS[dept.type] ?? 'bg-gray-100 text-gray-600',
                          )}>
                            {dept.type}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 text-gray-500 max-w-[200px]">
                        <span className="truncate block">{dept.description ?? '—'}</span>
                      </td>

                      {/* Head */}
                      <td className="px-4 py-3">
                        {dept.head_name ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={dept.head_name} size="xs" />
                            <span className="text-sm text-gray-600">{dept.head_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Count */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 font-medium">
                          {dept.employee_count ?? 0}
                        </span>
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td className="px-4 py-3">
                          {deleteConfirm === dept.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600">Delete?</span>
                              <button
                                onClick={() => deleteDept(dept.id)}
                                disabled={deleting}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingId(dept.id); setAddingNew(false) }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600
                                  hover:bg-blue-50 transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(dept.id)}
                                disabled={(dept.employee_count ?? 0) > 0}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600
                                  hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title={(dept.employee_count ?? 0) > 0 ? 'Cannot delete — has employees' : 'Delete'}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default DepartmentsPage
