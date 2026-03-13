export type ProjectStatus =
  | 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Project {
  id: string
  name: string
  description?: string
  status: ProjectStatus
  start_date?: string
  end_date?: string
  manager_id?: string
  progress: number
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assignee_id?: string
  due_date?: string
  estimated_hours?: number
  created_at: string
}
