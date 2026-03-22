import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Moon, Edit2, Power } from 'lucide-react'
import { shiftService, type CreateShiftPayload } from '@/services/shift.service'
import type { Shift } from '@/types/attendance.types'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import Badge from '@/components/common/Badge'
import { cn } from '@/utils/cn'

// ── Create/Edit Modal ─────────────────────────────────────────────────────────
const ShiftModal = ({
  shift,
  onClose,
}: {
  shift?: Shift | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const isEdit = !!shift
  const [form, setForm] = useState({
    name:           shift?.name ?? '',
    start_time:     shift?.start_time ?? '09:00',
    end_time:       shift?.end_time ?? '18:00',
    grace_minutes:  String(shift?.grace_minutes ?? 10),
    is_night_shift: shift?.is_night_shift ?? false,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload: CreateShiftPayload = {
        name:           form.name,
        start_time:     form.start_time,
        end_time:       form.end_time,
        grace_minutes:  Number(form.grace_minutes) || 10,
        is_night_shift: form.is_night_shift,
      }
      return isEdit
        ? shiftService.update(shift!.id, payload)
        : shiftService.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Shift updated' : 'Shift created')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed'),
  })

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Shift' : 'Create Shift'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Shift Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Morning, Night, General"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Start Time</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => set('start_time', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">End Time</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => set('end_time', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
            Grace Period (minutes)
          </label>
          <input
            type="number"
            min="0"
            max="60"
            value={form.grace_minutes}
            onChange={(e) => set('grace_minutes', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Employee marked late after start + grace period
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_night_shift}
            onChange={(e) => set('is_night_shift', e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-200">Night shift (crosses midnight)</span>
        </label>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            loading={isPending}
            disabled={!form.name.trim()}
            onClick={() => mutate()}
          >
            {isEdit ? 'Update' : 'Create Shift'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const ShiftManagement = () => {
  const [modalShift, setModalShift] = useState<Shift | null | 'new'>()
  const queryClient = useQueryClient()

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: shiftService.list,
  })

  const { mutate: toggleActive } = useMutation({
    mutationFn: (shift: Shift) =>
      shiftService.update(shift.id, { is_active: !shift.is_active }),
    onSuccess: () => {
      toast.success('Shift updated')
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
    onError: () => toast.error('Failed to update shift'),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">Shift Management</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Define work shifts and assign them to employees
          </p>
        </div>
        <Button
          size="sm"
          leftIcon={<Plus size={13} />}
          onClick={() => setModalShift('new')}
        >
          New Shift
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          No shifts defined yet. Create a shift to get started.
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl divide-y dark:divide-gray-700">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3.5',
                !shift.is_active && 'opacity-50',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-white">{shift.name}</span>
                  {shift.is_night_shift && (
                    <Moon size={12} className="text-indigo-500" />
                  )}
                  {!shift.is_active && (
                    <Badge label="Inactive" className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px]" />
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {shift.start_time} – {shift.end_time}
                  <span className="ml-2 text-gray-400 dark:text-gray-500">
                    · {shift.grace_minutes}min grace
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setModalShift(shift)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50
                    rounded-lg transition-colors"
                  title="Edit shift"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => toggleActive(shift)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    shift.is_active
                      ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50',
                  )}
                  title={shift.is_active ? 'Deactivate' : 'Activate'}
                >
                  <Power size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalShift != null && (
        <ShiftModal
          shift={modalShift === 'new' ? null : (modalShift as Shift)}
          onClose={() => setModalShift(undefined)}
        />
      )}
    </div>
  )
}

export default ShiftManagement
