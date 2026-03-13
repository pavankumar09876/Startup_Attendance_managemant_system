import api from './api'
import type { Task, SubTask, TaskComment, TimeLog } from '@/types/project.types'

export interface TaskFilters {
  project_id?: string
  status?: string
  priority?: string
  assignee_id?: string
  due?: 'today' | 'week' | 'overdue' | 'completed'
  search?: string
  limit?: number
  skip?: number
}

export const taskService = {
  // ── My tasks (global, across all projects) ────────────────────────────────
  getMyTasks: (filters?: TaskFilters) =>
    api.get<Task[]>('/api/tasks/my', { params: filters }).then((r) => r.data),

  // ── Project tasks ─────────────────────────────────────────────────────────
  getProjectTasks: (projectId: string, filters?: TaskFilters) =>
    api
      .get<Task[]>(`/api/projects/${projectId}/tasks`, { params: filters })
      .then((r) => r.data),

  // ── Single task ───────────────────────────────────────────────────────────
  get: (taskId: string) =>
    api.get<Task>(`/api/tasks/${taskId}`).then((r) => r.data),

  create: (projectId: string, payload: Partial<Task>) =>
    api.post<Task>(`/api/projects/${projectId}/tasks`, payload).then((r) => r.data),

  update: (taskId: string, payload: Partial<Task>) =>
    api.patch<Task>(`/api/tasks/${taskId}`, payload).then((r) => r.data),

  updateStatus: (taskId: string, status: string) =>
    api.patch<Task>(`/api/tasks/${taskId}`, { status }).then((r) => r.data),

  delete: (taskId: string) =>
    api.delete(`/api/tasks/${taskId}`).then((r) => r.data),

  // ── Subtasks ──────────────────────────────────────────────────────────────
  getSubtasks: (taskId: string) =>
    api.get<SubTask[]>(`/api/tasks/${taskId}/subtasks`).then((r) => r.data),

  createSubtask: (taskId: string, title: string) =>
    api.post<SubTask>(`/api/tasks/${taskId}/subtasks`, { title }).then((r) => r.data),

  toggleSubtask: (taskId: string, subtaskId: string, completed: boolean) =>
    api
      .patch<SubTask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { completed })
      .then((r) => r.data),

  deleteSubtask: (taskId: string, subtaskId: string) =>
    api.delete(`/api/tasks/${taskId}/subtasks/${subtaskId}`).then((r) => r.data),

  // ── Comments ──────────────────────────────────────────────────────────────
  getComments: (taskId: string) =>
    api.get<TaskComment[]>(`/api/tasks/${taskId}/comments`).then((r) => r.data),

  addComment: (taskId: string, content: string) =>
    api
      .post<TaskComment>(`/api/tasks/${taskId}/comments`, { content })
      .then((r) => r.data),

  // ── Time logs ─────────────────────────────────────────────────────────────
  getTimeLogs: (taskId: string) =>
    api.get<TimeLog[]>(`/api/tasks/${taskId}/timelogs`).then((r) => r.data),

  logTime: (taskId: string, payload: { hours: number; description?: string; date: string }) =>
    api.post<TimeLog>(`/api/tasks/${taskId}/timelogs`, payload).then((r) => r.data),
}
