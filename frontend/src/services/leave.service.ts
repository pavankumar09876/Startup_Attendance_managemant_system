import api from './api'
import type {
  Leave, LeaveBalance, LeaveCreatePayload,
  Holiday, LeaveApprovalFilters,
} from '@/types/leave.types'

export interface PaginatedLeaves {
  leaves: Leave[]
  total: number
}

export const leaveService = {
  /** Employee: get own leave history */
  getMyLeaves: (params?: Record<string, unknown>) =>
    api.get<Leave[]>('/api/leaves/my', { params }).then((r) => r.data),

  /** Employee: get own leave balances */
  getMyBalances: () =>
    api.get<LeaveBalance[]>('/api/leaves/balances').then((r) => r.data),

  /** Employee: apply for leave */
  apply: (payload: LeaveCreatePayload) =>
    api.post<Leave>('/api/leaves', payload).then((r) => r.data),

  /** Employee: cancel a pending leave */
  cancel: (id: string) =>
    api.patch<Leave>(`/api/leaves/${id}/cancel`).then((r) => r.data),

  /** Admin/Manager: get all leave requests (with filters) */
  getAll: (filters?: LeaveApprovalFilters) =>
    api.get<PaginatedLeaves>('/api/leaves', { params: filters }).then((r) => r.data),

  /** Admin/Manager: approve a leave */
  approve: (id: string) =>
    api.patch<Leave>(`/api/leaves/${id}/review`, { status: 'approved' }).then((r) => r.data),

  /** Admin/Manager: reject a leave with reason */
  reject: (id: string, rejection_reason: string) =>
    api
      .patch<Leave>(`/api/leaves/${id}/review`, { status: 'rejected', rejection_reason })
      .then((r) => r.data),

  /** Admin/Manager: bulk approve */
  bulkApprove: (ids: string[]) =>
    api.post<{ updated: number }>('/api/leaves/bulk-approve', { ids }).then((r) => r.data),

  /** Holidays */
  getHolidays: (year?: number) =>
    api.get<Holiday[]>('/api/leaves/holidays', { params: { year } }).then((r) => r.data),
}
