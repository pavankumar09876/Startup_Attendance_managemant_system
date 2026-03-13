import api from './api'
import type { User, CreateUserPayload, Department } from '@/types/user.types'

export const userService = {
  list: (params?: Record<string, unknown>) =>
    api.get<User[]>('/api/users', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<User>(`/api/users/${id}`).then((r) => r.data),

  create: (payload: CreateUserPayload) =>
    api.post<User>('/api/users', payload).then((r) => r.data),

  update: (id: string, payload: Partial<User>) =>
    api.patch<User>(`/api/users/${id}`, payload).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/users/${id}`).then((r) => r.data),

  listDepartments: () =>
    api.get<Department[]>('/api/users/departments').then((r) => r.data),

  createDepartment: (payload: { name: string; description?: string }) =>
    api.post<Department>('/api/users/departments', payload).then((r) => r.data),
}
