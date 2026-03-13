import api from './api'
import type { Attendance, AttendanceSummary } from '@/types/attendance.types'

export const attendanceService = {
  list: (params?: Record<string, unknown>) =>
    api.get<Attendance[]>('/api/attendance', { params }).then((r) => r.data),

  checkIn: () =>
    api.post<Attendance>('/api/attendance/check-in').then((r) => r.data),

  checkOut: () =>
    api.post<Attendance>('/api/attendance/check-out').then((r) => r.data),

  getSummary: (employeeId: string, month: number, year: number) =>
    api
      .get<AttendanceSummary>(`/api/attendance/summary/${employeeId}`, {
        params: { month, year },
      })
      .then((r) => r.data),

  update: (id: string, payload: Partial<Attendance>) =>
    api.patch<Attendance>(`/api/attendance/${id}`, payload).then((r) => r.data),
}
