import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Check, X, Building2, Users, ChevronRight, Search } from 'lucide-react'

import { staffService } from '@/services/staff.service'
import type { Department } from '@/types/user.types'
import { useAuth } from '@/hooks/useAuth'
import { ROLES } from '@/constants/roles'
import Avatar from '@/components/common/Avatar'
import Button from '@/components/common/Button'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/utils/cn'

const TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  IT:       { color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-900/30' },
  'Non-IT': { color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  Other:    { color: 'text-gray-600 dark:text-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800' },
}

// ── Inline editor ───────────────────────────────────────────────────────────────
const EditCard = ({
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

  const inputCls = cn(
    'w-full px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-600 text-sm',
    'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
    'focus:outline-none focus:ring-2 focus:ring-blue-500',
  )

  return (
    <div className="card border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Department name"
            autoFocus
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
            <option value="IT">IT</option>
            <option value="Non-IT">Non-IT</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional description"
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-100 dark:border-blue-800">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || isSaving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white
            rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Check size={12} />
          {isSaving ? 'Saving…' : dept?.name ? 'Update' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-1.5 text-gray-500 dark:text-gray-400
            rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={12} />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Department Card ─────────────────────────────────────────────────────────────
const DeptCard = ({
  dept, canManage, onEdit, onDelete, isDeleting,
}: {
  dept: Department
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const badge = TYPE_BADGE[dept.type ?? 'Other'] ?? TYPE_BADGE.Other

  const accent = dept.type === 'IT'
    ? { border: 'border-l-blue-500', icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', countBg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' }
    : dept.type === 'Non-IT'
    ? { border: 'border-l-purple-500', icon: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', countBg: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' }
    : { border: 'border-l-gray-400 dark:border-l-gray-500', icon: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', countBg: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }

  return (
    <div className={cn(
      'card p-0 overflow-hidden group hover:shadow-lg transition-all border-l-[3px]',
      accent.border,
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', accent.icon)}>
            <Building2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight">
                {dept.name}
              </h3>
              <span className={cn('flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full', badge.bg, badge.color)}>
                {dept.type ?? 'Other'}
              </span>
            </div>
            {dept.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                {dept.description}
              </p>
            )}
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between gap-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
          {/* Head */}
          <div className="flex items-center gap-2 min-w-0">
            {dept.head_name ? (
              <>
                <Avatar name={dept.head_name} size="xs" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{dept.head_name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Head</p>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">No head assigned</p>
            )}
          </div>

          {/* Employee count */}
          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0', accent.countBg)}>
            {dept.employee_count ?? 0} {(dept.employee_count ?? 0) === 1 ? 'member' : 'members'}
          </span>
        </div>

        {/* Actions */}
        {canManage && (
          <div className="flex items-center gap-1 pt-2.5 border-t border-gray-100 dark:border-gray-800">
            {confirmDelete ? (
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-red-600 dark:text-red-400">Delete this department?</span>
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={() => { onDelete(); setConfirmDelete(false) }}
                    disabled={isDeleting}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? 'Deleting…' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    No
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400
                    hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Edit2 size={11} />
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={(dept.employee_count ?? 0) > 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400
                    hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors
                    disabled:opacity-30 disabled:cursor-not-allowed"
                  title={(dept.employee_count ?? 0) > 0 ? 'Cannot delete — has employees' : 'Delete'}
                >
                  <Trash2 size={11} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────────
const DepartmentsPage = () => {
  const { isAdmin, hasRole } = useAuth()
  const canManage = isAdmin || hasRole(ROLES.HR)
  const queryClient = useQueryClient()

  const [addingNew, setAddingNew]   = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [search, setSearch]         = useState('')

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: staffService.getDepartments,
    staleTime: 1000 * 60,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return departments
    const q = search.toLowerCase()
    return departments.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      d.type?.toLowerCase().includes(q)
    )
  }, [departments, search])

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
    onSuccess: () => { toast.success('Department deleted'); invalidate() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Cannot delete — employees assigned'),
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Departments</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {departments.length} department{departments.length !== 1 ? 's' : ''} in your organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search departments…"
              className="w-48 pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm
                bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:w-60 transition-all"
            />
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
      </div>

      {/* Add new form */}
      {addingNew && (
        <EditCard
          onSave={(payload) => create(payload)}
          onCancel={() => setAddingNew(false)}
          isSaving={creating}
        />
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden animate-pulse">
              <div className="h-1 bg-gray-200 dark:bg-gray-700" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && !addingNew ? (
        <EmptyState
          icon={<Building2 size={36} className="text-gray-300 dark:text-gray-600" />}
          title={search ? 'No matches found' : 'No departments yet'}
          description={search ? `No departments match "${search}".` : 'Create your first department to organize your team.'}
          action={!search && canManage ? (
            <Button size="sm" leftIcon={<Plus size={13} />} onClick={() => setAddingNew(true)}>
              Add Department
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((dept) =>
            editingId === dept.id ? (
              <EditCard
                key={dept.id}
                dept={dept}
                onSave={(payload) => update({ id: dept.id, payload })}
                onCancel={() => setEditingId(null)}
                isSaving={updating}
              />
            ) : (
              <DeptCard
                key={dept.id}
                dept={dept}
                canManage={canManage}
                onEdit={() => { setEditingId(dept.id); setAddingNew(false) }}
                onDelete={() => deleteDept(dept.id)}
                isDeleting={deleting}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

export default DepartmentsPage
