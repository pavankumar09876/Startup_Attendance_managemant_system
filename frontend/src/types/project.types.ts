export type ProjectStatus   = 'planning' | 'active' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'archived'
export type TaskStatus      = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
export type TaskPriority    = 'low' | 'medium' | 'high' | 'critical'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical'

export interface ProjectMember {
  id: string
  user_id: string
  name: string
  avatar?: string
  department?: string
  role_in_project: string
}

export interface Milestone {
  id: string
  project_id: string
  name: string
  due_date: string
  status: 'pending' | 'completed' | 'overdue'
  description?: string
}

export interface ProjectExpense {
  id: string
  project_id: string
  date: string
  description: string
  amount: number
  category: string
  submitted_by: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface Project {
  id: string
  name: string
  client_name?: string
  description?: string
  status: ProjectStatus
  priority: ProjectPriority
  start_date?: string
  end_date?: string
  manager_id?: string
  manager_name?: string
  manager_avatar?: string
  progress: number
  budget?: number
  spent?: number
  total_tasks?: number
  completed_tasks?: number
  member_count?: number
  members?: ProjectMember[]
  created_at: string
}

export interface Task {
  id: string
  project_id: string
  project_name?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assignee_id?: string
  assignee_name?: string
  assignee_avatar?: string
  due_date?: string
  estimated_hours?: number
  logged_hours?: number
  labels?: string[]
  subtask_count?: number
  completed_subtasks?: number
  created_at: string
}

export interface SubTask {
  id: string
  task_id: string
  title: string
  completed: boolean
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  user_name: string
  user_avatar?: string
  content: string
  created_at: string
}

export interface TimeLog {
  id: string
  task_id: string
  user_id: string
  user_name: string
  hours: number
  description?: string
  date: string
  created_at: string
}

export interface CreateProjectPayload {
  name: string
  client_name?: string
  description?: string
  status: ProjectStatus
  priority: ProjectPriority
  start_date?: string
  end_date?: string
  budget?: number
  members?: { user_id: string; role: string }[]
}
