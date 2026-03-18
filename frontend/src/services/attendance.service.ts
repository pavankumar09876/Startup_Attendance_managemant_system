import api from './api'
import type {
  Attendance, AttendanceSummary, TodayStatus,
  Regularization, TeamAttendanceFilters,
} from '@/types/attendance.types'

export interface RegularizationPayload {
  date: string
  check_in: string
  check_out: string
  reason: string
}

export interface OverridePayload {
  check_in?: string
  check_out?: string
  status?: string
  notes?: string
}

export interface PaginatedTeamAttendance {
  records: import('@/types/attendance.types').TeamAttendanceRecord[]
  summary: import('@/types/attendance.types').TeamAttendanceSummary
  total: number
}

export const attendanceService = {
  clockIn: (location: 'office' | 'remote' | 'wfh' = 'office') =>
    api.post<Attendance>('/api/attendance/check-in', {}, {
      params: location === 'wfh' ? { wfh: true } : {},
    }).then((r) => r.data),

  clockOut: () =>
    api.post<Attendance>('/api/attendance/clock-out').then((r) => r.data),

  getTodayStatus: () =>
    api.get<TodayStatus>('/api/attendance/today').then((r) => r.data),

  getMyAttendance: (month: number, year: number) =>
    api.get<Attendance[]>('/api/attendance/my', { params: { month, year } }).then((r) => r.data),

  getMonthSummary: (userId: string, month: number, year: number) =>
    api.get<AttendanceSummary>('/api/attendance/summary', { params: { user_id: userId, month, year } }).then((r) => r.data),

  submitRegularization: (data: RegularizationPayload) =>
    api.post<Regularization>('/api/attendance/regularize', data).then((r) => r.data),

  getMyRegularizations: () =>
    api.get<Regularization[]>('/api/attendance/regularizations').then((r) => r.data),

  getTeamAttendance: (filters: TeamAttendanceFilters) =>
    api.get<PaginatedTeamAttendance>('/api/attendance/team', { params: filters }).then((r) => r.data),

  override: (id: string, payload: OverridePayload) =>
    api.patch<Attendance>(`/api/attendance/${id}`, payload).then((r) => r.data),

  reviewRegularization: (id: string, status: 'approved' | 'rejected') =>
    api.patch<Regularization>(`/api/attendance/regularizations/${id}`, { status }).then((r) => r.data),

  exportCsv: (filters: TeamAttendanceFilters) =>
    api.get('/api/attendance/export', { params: filters, responseType: 'blob' }).then((r) => r.data as Blob),

  checkIn: () =>
    api.post<Attendance>('/api/attendance/check-in').then((r) => r.data),

  checkOut: () =>
    api.post<Attendance>('/api/attendance/check-out').then((r) => r.data),

  getByRange: (startDate: string, endDate: string, employeeId?: string) =>
    api.get<Attendance[]>('/api/attendance', {
      params: { start_date: startDate, end_date: endDate, employee_id: employeeId, limit: 400 },
    }).then((r) => r.data),

  breakStart: () =>
    api.post<Attendance>('/api/attendance/break-start').then((r) => r.data),

  breakEnd: () =>
    api.post<Attendance>('/api/attendance/break-end').then((r) => r.data),
}
