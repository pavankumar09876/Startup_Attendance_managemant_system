import api from './api'
import type { Leave, LeaveCreatePayload } from '@/types/leave.types'

export const leaveService = {
  list: (params?: Record<string, unknown>) =>
    api.get<Leave[]>('/api/leaves', { params }).then((r) => r.data),

  apply: (payload: LeaveCreatePayload) =>
    api.post<Leave>('/api/leaves', payload).then((r) => r.data),

  review: (id: string, payload: { status: string; rejection_reason?: string }) =>
    api.patch<Leave>(`/api/leaves/${id}/review`, payload).then((r) => r.data),

  cancel: (id: string) =>
    api.delete(`/api/leaves/${id}`).then((r) => r.data),
}
