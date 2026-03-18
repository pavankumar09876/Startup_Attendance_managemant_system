import api from './api'
import type { Shift } from '@/types/attendance.types'

export interface CreateShiftPayload {
  name: string
  start_time: string
  end_time: string
  grace_minutes?: number
  is_night_shift?: boolean
}

export const shiftService = {
  list: () =>
    api.get<Shift[]>('/api/shifts/').then((r) => r.data),

  create: (payload: CreateShiftPayload) =>
    api.post<Shift>('/api/shifts/', payload).then((r) => r.data),

  update: (id: string, payload: Partial<CreateShiftPayload> & { is_active?: boolean }) =>
    api.patch<Shift>(`/api/shifts/${id}`, payload).then((r) => r.data),

  deactivate: (id: string) =>
    api.delete(`/api/shifts/${id}`).then((r) => r.data),

  assignToUser: (shiftId: string, userId: string) =>
    api.post(`/api/shifts/${shiftId}/assign/${userId}`).then((r) => r.data),

  unassignFromUser: (userId: string) =>
    api.delete(`/api/shifts/assign/${userId}`).then((r) => r.data),
}
