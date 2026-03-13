import api from './api'
import type { Project, Task } from '@/types/project.types'

export const projectService = {
  list: (params?: Record<string, unknown>) =>
    api.get<Project[]>('/api/projects', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Project>(`/api/projects/${id}`).then((r) => r.data),

  create: (payload: Partial<Project> & { member_ids?: string[] }) =>
    api.post<Project>('/api/projects', payload).then((r) => r.data),

  update: (id: string, payload: Partial<Project>) =>
    api.patch<Project>(`/api/projects/${id}`, payload).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/projects/${id}`).then((r) => r.data),

  listTasks: (projectId: string) =>
    api.get<Task[]>(`/api/projects/${projectId}/tasks`).then((r) => r.data),

  createTask: (projectId: string, payload: Partial<Task>) =>
    api.post<Task>(`/api/projects/${projectId}/tasks`, payload).then((r) => r.data),

  updateTask: (taskId: string, payload: Partial<Task>) =>
    api.patch<Task>(`/api/projects/tasks/${taskId}`, payload).then((r) => r.data),

  deleteTask: (taskId: string) =>
    api.delete(`/api/projects/tasks/${taskId}`).then((r) => r.data),
}
