import api from './api'
import type { Sprint } from '@/types/project.types'

export interface CreateSprintPayload {
  name: string
  goal?: string
  start_date?: string
  end_date?: string
  capacity?: number
}

export interface CompleteSprintPayload {
  move_incomplete_to_sprint_id?: string | null
}

export const sprintService = {
  list: (projectId: string) =>
    api.get<Sprint[]>(`/api/projects/${projectId}/sprints`).then((r) => r.data),

  create: (projectId: string, payload: CreateSprintPayload) =>
    api.post<Sprint>(`/api/projects/${projectId}/sprints`, payload).then((r) => r.data),

  update: (sprintId: string, payload: Partial<CreateSprintPayload>) =>
    api.patch<Sprint>(`/api/sprints/${sprintId}`, payload).then((r) => r.data),

  start: (sprintId: string) =>
    api.post<Sprint>(`/api/sprints/${sprintId}/start`).then((r) => r.data),

  complete: (sprintId: string, payload: CompleteSprintPayload) =>
    api.post<Sprint>(`/api/sprints/${sprintId}/complete`, payload).then((r) => r.data),

  remove: (sprintId: string) =>
    api.delete(`/api/sprints/${sprintId}`).then((r) => r.data),
}
