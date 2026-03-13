import api from './api'
import type {
  Project, Task, ProjectMember, Milestone,
  ProjectExpense, CreateProjectPayload,
} from '@/types/project.types'

export interface ProjectFilters {
  status?: string
  search?: string
  skip?: number
  limit?: number
}

export interface PaginatedProjects {
  projects: Project[]
  total: number
}

export const projectService = {
  // ── Projects ──────────────────────────────────────────────────────────────
  list: (filters?: ProjectFilters) =>
    api.get<PaginatedProjects>('/api/projects', { params: filters }).then((r) => r.data),

  get: (id: string) =>
    api.get<Project>(`/api/projects/${id}`).then((r) => r.data),

  create: (payload: CreateProjectPayload) =>
    api.post<Project>('/api/projects', payload).then((r) => r.data),

  update: (id: string, payload: Partial<Project>) =>
    api.patch<Project>(`/api/projects/${id}`, payload).then((r) => r.data),

  archive: (id: string) =>
    api.patch<Project>(`/api/projects/${id}`, { status: 'cancelled' }).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/projects/${id}`).then((r) => r.data),

  // ── Members ───────────────────────────────────────────────────────────────
  getMembers: (projectId: string) =>
    api.get<ProjectMember[]>(`/api/projects/${projectId}/members`).then((r) => r.data),

  addMember: (projectId: string, userId: string, role_in_project: string) =>
    api
      .post<ProjectMember>(`/api/projects/${projectId}/members`, { user_id: userId, role_in_project })
      .then((r) => r.data),

  removeMember: (projectId: string, userId: string) =>
    api.delete(`/api/projects/${projectId}/members/${userId}`).then((r) => r.data),

  // ── Tasks ─────────────────────────────────────────────────────────────────
  listTasks: (projectId: string, params?: Record<string, unknown>) =>
    api.get<Task[]>(`/api/projects/${projectId}/tasks`, { params }).then((r) => r.data),

  createTask: (projectId: string, payload: Partial<Task>) =>
    api.post<Task>(`/api/projects/${projectId}/tasks`, payload).then((r) => r.data),

  updateTask: (taskId: string, payload: Partial<Task>) =>
    api.patch<Task>(`/api/projects/tasks/${taskId}`, payload).then((r) => r.data),

  deleteTask: (taskId: string) =>
    api.delete(`/api/projects/tasks/${taskId}`).then((r) => r.data),

  // ── Milestones ────────────────────────────────────────────────────────────
  getMilestones: (projectId: string) =>
    api.get<Milestone[]>(`/api/projects/${projectId}/milestones`).then((r) => r.data),

  // ── Budget / Expenses ─────────────────────────────────────────────────────
  getExpenses: (projectId: string) =>
    api.get<ProjectExpense[]>(`/api/projects/${projectId}/expenses`).then((r) => r.data),
}
