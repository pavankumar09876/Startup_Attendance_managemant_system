import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react'

import { settingsService } from '@/services/settings.service'
import type { LeaveType } from '@/services/settings.service'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

// ── Toggle switch ─────────────────────────────────────────────────────────────
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
      checked ? 'bg-blue-600' : 'bg-gray-200',
    )}
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200',
        checked ? 'translate-x-4' : 'translate-x-0',
      )}
    />
  </button>
)

// ── Inline row form ───────────────────────────────────────────────────────────
type LeaveForm = Omit<LeaveType, 'id' | 'created_at'>

const defaultForm = (): LeaveForm => ({
  name:           '',
  days_per_year:  12,
  carry_forward:  false,
  max_carry_days: 0,
  is_paid:        true,
})

const EditRow = ({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: LeaveForm
  onSave: (f: LeaveForm) => void
  onCancel: () => void
  isSaving: boolean
}) => {
  const [form, setForm] = useState<LeaveForm>(initial ?? defaultForm())
  const set = (k: keyof LeaveForm, v: any) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <tr className="bg-blue-50">
      {/* Name */}
      <td className="px-4 py-2">
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Casual Leave"
          autoFocus
          className="w-full px-2.5 py-1.5 rounded-lg border border-blue-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      {/* Days */}
      <td className="px-4 py-2">
        <input
          type="number"
          min="1"
          max="365"
          value={form.days_per_year}
          onChange={(e) => set('days_per_year', Number(e.target.value))}
          className="w-20 px-2.5 py-1.5 rounded-lg border border-blue-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      {/* Carry forward */}
      <td className="px-4 py-2">
        <ToggleSwitch checked={form.carry_forward} onChange={(v) => set('carry_forward', v)} />
      </td>
      {/* Max carry */}
      <td className="px-4 py-2">
        <input
          type="number"
          min="0"
          max="365"
          value={form.max_carry_days ?? 0}
          disabled={!form.carry_forward}
          onChange={(e) => set('max_carry_days', Number(e.target.value))}
          className={cn(
            'w-20 px-2.5 py-1.5 rounded-lg border border-blue-300 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            !form.carry_forward && 'opacity-40 cursor-not-allowed',
          )}
        />
      </td>
      {/* Paid / Unpaid */}
      <td className="px-4 py-2">
        <select
          value={form.is_paid ? 'paid' : 'unpaid'}
          onChange={(e) => set('is_paid', e.target.value === 'paid')}
          className="px-2.5 py-1.5 rounded-lg border border-blue-300 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </td>
      {/* Actions */}
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

// ── Main ──────────────────────────────────────────────────────────────────────
const LeaveSettings = () => {
  const queryClient = useQueryClient()
  const [addingNew,    setAddingNew]    = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)

  const { data: leaveTypes = [], isLoading } = useQuery({
    queryKey: ['leave-types-settings'],
    queryFn: settingsService.getLeaveTypes,
    staleTime: 1000 * 60 * 5,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['leave-types-settings'] })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: (payload: LeaveForm) => settingsService.createLeaveType(payload),
    onSuccess: () => { toast.success('Leave type added'); setAddingNew(false); invalidate() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<LeaveType> }) =>
      settingsService.updateLeaveType(id, payload),
    onSuccess: () => { toast.success('Leave type updated'); setEditingId(null); invalidate() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const { mutate: del, isPending: deleting } = useMutation({
    mutationFn: (id: string) => settingsService.deleteLeaveType(id),
    onSuccess: () => { toast.success('Leave type deleted'); setDeleteId(null); invalidate() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Cannot delete — in use'),
  })

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Leave Policies</h3>
          <p className="text-xs text-gray-400 mt-0.5">{leaveTypes.length} leave types configured</p>
        </div>
        {!addingNew && (
          <Button
            size="sm"
            leftIcon={<Plus size={13} />}
            onClick={() => { setAddingNew(true); setEditingId(null) }}
          >
            Add Leave Type
          </Button>
        )}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Leave Name', 'Days / Year', 'Carry Forward', 'Max Carry Days', 'Type', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Add new row */}
                {addingNew && (
                  <EditRow
                    onSave={(f) => create(f)}
                    onCancel={() => setAddingNew(false)}
                    isSaving={creating}
                  />
                )}

                {leaveTypes.length === 0 && !addingNew ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-gray-400">
                      No leave types configured. Add your first one above.
                    </td>
                  </tr>
                ) : (
                  leaveTypes.map((lt) =>
                    editingId === lt.id ? (
                      <EditRow
                        key={lt.id}
                        initial={{
                          name:           lt.name,
                          days_per_year:  lt.days_per_year,
                          carry_forward:  lt.carry_forward,
                          max_carry_days: lt.max_carry_days,
                          is_paid:        lt.is_paid,
                        }}
                        onSave={(f) => update({ id: lt.id, payload: f })}
                        onCancel={() => setEditingId(null)}
                        isSaving={updating}
                      />
                    ) : (
                      <tr key={lt.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-4 py-3 font-medium text-gray-800">{lt.name}</td>
                        <td className="px-4 py-3 text-gray-700">{lt.days_per_year}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            lt.carry_forward ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                          )}>
                            {lt.carry_forward ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {lt.carry_forward ? (lt.max_carry_days ?? '—') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            lt.is_paid ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500',
                          )}>
                            {lt.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {deleteId === lt.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600">Delete?</span>
                              <button
                                onClick={() => del(lt.id)}
                                disabled={deleting}
                                className="text-xs font-medium text-red-600 hover:text-red-800"
                              >Yes</button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >No</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingId(lt.id); setAddingNew(false) }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteId(lt.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default LeaveSettings
