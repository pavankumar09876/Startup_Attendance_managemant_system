import api from './api'
import type {
  User, Department, CreateUserPayload,
  PaginatedUsers, EmployeeFilters, Payslip,
} from '@/types/user.types'
import type { LeaveBalance } from '@/types/leave.types'

export const staffService = {
  // ── Employees ─────────────────────────────────────────────────────────────
  getEmployees: (filters?: EmployeeFilters) =>
    api.get<PaginatedUsers>('/api/users', { params: filters }).then((r) => r.data),

  getEmployee: (id: string) =>
    api.get<User>(`/api/users/${id}`).then((r) => r.data),

  createEmployee: (payload: CreateUserPayload) =>
    api.post<User>('/api/users', payload).then((r) => r.data),

  updateEmployee: (id: string, payload: Partial<User> & { password?: string }) =>
    api.patch<User>(`/api/users/${id}`, payload).then((r) => r.data),

  toggleStatus: (id: string, is_active: boolean) =>
    api.patch<User>(`/api/users/${id}`, { is_active }).then((r) => r.data),

  deleteEmployee: (id: string) =>
    api.delete(`/api/users/${id}`).then((r) => r.data),

  generateEmployeeId: () =>
    api.get<{ employee_id: string }>('/api/users/generate-id').then((r) => r.data),

  // ── Employee sub-resources ────────────────────────────────────────────────
  getEmployeeAttendance: (id: string, year: number, month: number) =>
    api
      .get(`/api/users/${id}/attendance`, { params: { year, month } })
      .then((r) => r.data),

  getEmployeeLeaveBalances: (id: string) =>
    api.get<LeaveBalance[]>(`/api/users/${id}/leave-balances`).then((r) => r.data),

  getEmployeeLeaves: (id: string) =>
    api.get(`/api/users/${id}/leaves`).then((r) => r.data),

  getEmployeeProjects: (id: string) =>
    api.get(`/api/users/${id}/projects`).then((r) => r.data),

  getEmployeePayslips: (id: string) =>
    api.get<Payslip[]>(`/api/users/${id}/payslips`).then((r) => r.data),

  downloadPayslip: (id: string, payslipId: string) =>
    api
      .get(`/api/users/${id}/payslips/${payslipId}/download`, { responseType: 'blob' })
      .then((r) => r.data),

  // ── Departments ───────────────────────────────────────────────────────────
  getDepartments: () =>
    api.get<Department[]>('/api/users/departments').then((r) => r.data),

  createDepartment: (payload: Partial<Department>) =>
    api.post<Department>('/api/users/departments', payload).then((r) => r.data),

  updateDepartment: (id: string, payload: Partial<Department>) =>
    api.patch<Department>(`/api/users/departments/${id}`, payload).then((r) => r.data),

  deleteDepartment: (id: string) =>
    api.delete(`/api/users/departments/${id}`).then((r) => r.data),
}
