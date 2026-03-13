/**
 * ReportScheduler — lets admins schedule recurring report emails.
 * Stored in settings.service.ts (report_schedules endpoint).
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, Mail, Calendar, Clock, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '@/services/api'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

interface ReportSchedule {
  id:          string
  name:        string
  report_type: string
  frequency:   'daily' | 'weekly' | 'monthly'
  day_of_week?: number   // 0=Mon for weekly
  day_of_month?: number  // 1–28 for monthly
  time:        string    // HH:MM
  recipients:  string[]
  is_active:   boolean
}

const FREQUENCIES = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const REPORT_TYPES = [
  { value: 'attendance', label: 'Attendance Report' },
  { value: 'payroll',    label: 'Payroll Report' },
  { value: 'projects',   label: 'Project Report' },
  { value: 'team',       label: 'Team Utilisation' },
]

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const fetchSchedules = () =>
  api.get<ReportSchedule[]>('/api/settings/report-schedules').then((r) => r.data).catch(() => [] as ReportSchedule[])

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const ReportScheduler = () => {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name:          '',
    report_type:   'attendance',
    frequency:     'weekly' as 'daily' | 'weekly' | 'monthly',
    day_of_week:   0,
    day_of_month:  1,
    time:          '09:00',
    recipients:    '',
    is_active:     true,
  })

  const { data: schedules = [] } = useQuery({
    queryKey: ['report-schedules'],
    queryFn:  fetchSchedules,
    staleTime: 1000 * 60 * 5,
  })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: (payload: Omit<ReportSchedule, 'id'>) =>
      api.post('/api/settings/report-schedules', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('Schedule created!')
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] })
    },
    onError: () => toast.error('Failed to create schedule'),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/api/settings/report-schedules/${id}`, { is_active }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report-schedules'] }),
  })

  const { mutate: del } = useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/report-schedules/${id}`),
    onSuccess: () => {
      toast.success('Schedule deleted')
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] })
    },
  })

  const handleCreate = () => {
    const recipients = form.recipients.split(',').map((e) => e.trim()).filter(Boolean)
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (recipients.length === 0) { toast.error('Add at least one recipient'); return }
    create({
      name:          form.name,
      report_type:   form.report_type,
      frequency:     form.frequency,
      day_of_week:   form.day_of_week,
      day_of_month:  form.day_of_month,
      time:          form.time,
      recipients,
      is_active:     form.is_active,
    })
  }

  const frequencyLabel = (s: ReportSchedule) => {
    if (s.frequency === 'daily')   return `Every day at ${s.time}`
    if (s.frequency === 'weekly')  return `Every ${DAY_NAMES[s.day_of_week ?? 0]} at ${s.time}`
    return `Monthly on day ${s.day_of_month} at ${s.time}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Scheduled Reports</h3>
          <p className="text-xs text-gray-400 mt-0.5">Automatically email reports on a schedule</p>
        </div>
        {!showForm && (
          <Button size="sm" leftIcon={<Plus size={13} />} onClick={() => setShowForm(true)}>
            New Schedule
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">New Report Schedule</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Schedule Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Weekly Attendance to HR"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Report Type</label>
              <select
                value={form.report_type}
                onChange={(e) => setForm((p) => ({ ...p, report_type: e.target.value }))}
                className={inputCls}
              >
                {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as any }))}
                className={inputCls}
              >
                {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            {form.frequency === 'weekly' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Day of Week</label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm((p) => ({ ...p, day_of_week: Number(e.target.value) }))}
                  className={inputCls}
                >
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {form.frequency === 'monthly' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Day of Month</label>
                <input
                  type="number" min="1" max="28"
                  value={form.day_of_month}
                  onChange={(e) => setForm((p) => ({ ...p, day_of_month: Number(e.target.value) }))}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Recipients (comma-separated emails)
              </label>
              <input
                value={form.recipients}
                onChange={(e) => setForm((p) => ({ ...p, recipients: e.target.value }))}
                placeholder="hr@company.com, ceo@company.com"
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" loading={creating} onClick={handleCreate}>Create Schedule</Button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {schedules.length === 0 && !showForm ? (
        <div className="card py-10 text-center">
          <Mail size={24} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No report schedules yet.</p>
          <p className="text-xs text-gray-300 mt-1">Create one to automate report delivery by email.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.id} className="card p-4 flex items-center gap-4">
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                s.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400',
              )}>
                <Calendar size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white">{s.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500">
                    {REPORT_TYPES.find((r) => r.value === s.report_type)?.label}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} /> {frequencyLabel(s)}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Mail size={10} /> {s.recipients.length} recipient{s.recipients.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggle({ id: s.id, is_active: !s.is_active })}
                  className={cn('transition-colors', s.is_active ? 'text-blue-500' : 'text-gray-300 hover:text-gray-400')}
                  title={s.is_active ? 'Disable schedule' : 'Enable schedule'}
                >
                  {s.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => del(s.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ReportScheduler
