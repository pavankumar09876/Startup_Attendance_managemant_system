export type ProjectStatus   = 'planning' | 'active' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' | 'archived'
export type TaskStatus      = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked'
export type TaskPriority    = 'low' | 'medium' | 'high' | 'critical'
export type IssueType       = 'task' | 'bug' | 'story' | 'epic'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical'

export type ProjectRoleType = 'owner' | 'manager' | 'contributor' | 'viewer'

export interface ProjectMember {
  id: string
  user_id: string
  name: string
  avatar?: string
  department?: string
  role_in_project: ProjectRoleType
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

export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal?: string
  status: SprintStatus
  start_date?: string
  end_date?: string
  capacity?: number
  completed_at?: string
  created_at: string
  // Computed metrics
  total_tasks: number
  completed_tasks: number
  completion_pct: number
  total_story_points: number
  completed_story_points: number
  velocity?: number
  days_remaining?: number
  burn_rate?: number
  over_capacity?: boolean
}

export interface MemberWorkload {
  user_id: string
  name: string
  avatar?: string
  task_count: number
  story_points: number
  completed_tasks: number
  leave_days: number
  available_days?: number
}

export interface SprintWorkload {
  sprint_id: string
  capacity?: number
  total_story_points: number
  over_capacity: boolean
  unassigned_points: number
  unassigned_tasks: number
  members: MemberWorkload[]
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
  sprint_id?: string
  story_points?: number
  issue_type?: IssueType
  parent_id?: string
  epic_id?: string
  epic_title?: string
  created_at: string
}

export interface EpicProgress {
  total_children: number
  done: number
  progress_pct: number
  status_breakdown: Record<string, number>
  total_story_points: number
  completed_story_points: number
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

export interface TaskActivity {
  id: string
  task_id: string
  actor_id: string
  actor_name: string
  action: string          // created, updated, deleted, commented
  field?: string          // e.g. status, assignee, priority
  old_value?: string
  new_value?: string
  created_at: string
}

export interface SavedTaskView {
  id: string
  user_id: string
  name: string
  filters: Record<string, string | undefined>
  is_default: boolean
  position: number
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
  members?: { user_id: string; role: ProjectRoleType }[]
}
