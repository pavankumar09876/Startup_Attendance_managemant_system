import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  Search, Download, ChevronLeft, ChevronRight,
  Pencil, X, Clock,
} from 'lucide-react'

import api from '@/services/api'
import { attendanceService, type OverridePayload } from '@/services/attendance.service'
import type { TeamAttendanceRecord, TeamAttendanceFilters } from '@/types/attendance.types'
import { formatDate } from '@/utils/formatDate'
import { ATTENDANCE_STATUS_COLORS } from '@/constants/status'
import { useDebounce } from '@/hooks/useDebounce'
import Avatar from '@/components/common/Avatar'
import Badge from '@/components/common/Badge'
import Button from '@/components/common/Button'
import Modal from '@/components/common/Modal'
import EmptyState from '@/components/common/EmptyState'
import DatePicker from '@/components/common/DatePicker'

const PAGE_SIZE = 20

const STATUSES = ['all', 'present', 'absent', 'late', 'wfh', 'on_leave']

// ── Override modal ────────────────────────────────────────────────────────────
const overrideSchema = z.object({
  check_in:  z.string().optional(),
  check_out: z.string().optional(),
  status:    z.string().optional(),
  notes:     z.string().optional(),
})
type OverrideForm = z.infer<typeof overrideSchema>

const OverrideModal = ({
  record,
  onClose,
}: {
  record: TeamAttendanceRecord | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()

  const { register, handleSubmit } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      check_in:  record?.check_in?.slice(0, 5) ?? '',
      check_out: record?.check_out?.slice(0, 5) ?? '',
      status:    record?.status ?? '',
      notes:     record?.notes ?? '',
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: OverridePayload) => attendanceService.override(record!.id, data),
    onSuccess: () => {
      toast.success('Record updated')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'team'] })
      onClose()
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Update failed'),
  })

  if (!record) return null

  return (
    <Modal open={!!record} onClose={onClose} title="Override Attendance Record" size="sm">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Editing record for{' '}
        <span className="font-medium text-gray-800 dark:text-gray-100">{record.employee_name}</span> on{' '}
        <span className="font-medium text-gray-800 dark:text-gray-100">{formatDate(record.date)}</span>
      </p>
      <form
        onSubmit={handleSubmit((d) => mutate(d as OverridePayload))}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Check In</label>
            <input
              type="time"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('check_in')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Check Out</label>
            <input
              type="time"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('check_out')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Status</label>
          <select
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('status')}
          >
            {['present', 'absent', 'late', 'half_day', 'wfh', 'on_leave'].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Admin Note</label>
          <textarea
            rows={2}
            placeholder="Optional note…"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
            {...register('notes')}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} className="flex-1">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────
const SummaryBar = ({ summary }: { summary: import('@/types/attendance.types').TeamAttendanceSummary }) => {
  const pct = summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(1) : '0'
  const items = [
    { label: 'Total',   value: summary.total,   color: 'text-gray-800 dark:text-gray-100' },
    { label: 'Present', value: `${summary.present} (${pct}%)`, color: 'text-green-600' },
    { label: 'Absent',  value: summary.absent,  color: 'text-red-600' },
    { label: 'Late',    value: summary.late,    color: 'text-amber-600' },
    { label: 'WFH',     value: summary.wfh,     color: 'text-blue-600' },
  ]
  return (
    <div className="flex flex-wrap gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}:</span>
          <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const TeamAttendance = () => {
  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [department, setDepartment]   = useState('')
  const [status, setStatus]           = useState('all')
  const [dateFrom, setDateFrom]       = useState(format(new Date(), 'yyyy-MM-01'))
  const [dateTo, setDateTo]           = useState(format(new Date(), 'yyyy-MM-dd'))
  const [overrideRecord, setOverride] = useState<TeamAttendanceRecord | null>(null)
  const [exporting, setExporting]     = useState(false)

  const debouncedSearch = useDebounce(search, 400)

  // Fetch departments dynamically
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/api/users/departments').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  })

  const filters: TeamAttendanceFilters = {
    search:     debouncedSearch || undefined,
    department: department || undefined,
    status:     status !== 'all' ? status : undefined,
    date_from:  dateFrom || undefined,
    date_to:    dateTo || undefined,
    skip:       (page - 1) * PAGE_SIZE,
    limit:      PAGE_SIZE,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'team', filters],
    queryFn: () => attendanceService.getTeamAttendance(filters),
    staleTime: 1000 * 30,
  })

  const records  = data?.records ?? []
  const total    = data?.total ?? 0
  const summary  = data?.summary
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await attendanceService.exportCsv(filters)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `attendance_${dateFrom}_${dateTo}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Department */}
          <div className="min-w-[160px]">
            <select
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {(departments ?? []).map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="min-w-[140px]">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'All Status' : s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1) }} max={dateTo} placeholder="From" />
            <span className="text-gray-400 dark:text-gray-500 text-sm">–</span>
            <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1) }} min={dateFrom} placeholder="To" />
          </div>

          {/* Export */}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download size={14} />}
            loading={exporting}
            onClick={handleExport}
            className="ml-auto"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Summary bar ─────────────────────────────────────── */}
      {summary && <SummaryBar summary={summary} />}

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<Clock size={40} className="text-gray-300 dark:text-gray-600" />}
            title="No records found"
            description="Try adjusting your filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {['Employee', 'Department', 'Date', 'Check In', 'Check Out', 'Hours', 'Status', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 first:rounded-l-none last:rounded-r-none"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={rec.employee_name} src={rec.employee_avatar} size="sm" />
                        <span className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-[130px]">
                          {rec.employee_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{rec.department}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                      {formatDate(rec.date, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 tabular-nums">
                      {rec.check_in?.slice(0, 5) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 tabular-nums">
                      {rec.check_out?.slice(0, 5) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200 tabular-nums">
                      {rec.working_hours ? `${rec.working_hours.toFixed(1)}h` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={rec.status}
                        className={ATTENDANCE_STATUS_COLORS[rec.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setOverride(rec)}
                        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Override record"
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────── */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span key={`e-${p}`} className="px-1 text-gray-400 dark:text-gray-500 text-xs">…</span>
                    )}
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                        p === page ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  </>
                ))}
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Override modal */}
      <OverrideModal record={overrideRecord} onClose={() => setOverride(null)} />
    </div>
  )
}

export default TeamAttendance
