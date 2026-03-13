import api from './api'

// ── Shared ────────────────────────────────────────────────────────────────────
export interface TrendPoint { date: string; present: number; absent: number }
export interface DeptHeadcount { department: string; count: number }
export interface LeaveDistribution { type: string; value: number }
export interface RecentActivity { id: string; user: string; avatar?: string; action: string; created_at: string }
export interface AbsentEmployee { id: string; name: string; department: string; last_seen: string }
export interface PendingApproval { id: string; employee: string; type: string; since: string }

// ── Admin stats ───────────────────────────────────────────────────────────────
export interface AdminStats {
  total_employees: number
  active_employees: number
  present_today: number
  attendance_pct: number
  pending_leaves: number
  open_projects: number
  attendance_trend: TrendPoint[]
  dept_headcount: DeptHeadcount[]
  leave_distribution: LeaveDistribution[]
  absent_today: AbsentEmployee[]
  pending_approvals: PendingApproval[]
  recent_activity: RecentActivity[]
}

// ── Manager stats ─────────────────────────────────────────────────────────────
export interface ProjectProgress { id: string; name: string; progress: number; status: string; deadline?: string }
export interface TaskStatusBreakdown { status: string; count: number }
export interface AtRiskTask { id: string; title: string; project: string; due_date: string; assignee: string }

export interface ManagerStats {
  my_projects: number
  tasks_due_today: number
  team_members: number
  budget_used_pct: number
  project_progress: ProjectProgress[]
  task_breakdown: TaskStatusBreakdown[]
  at_risk_tasks: AtRiskTask[]
}

// ── Employee stats ────────────────────────────────────────────────────────────
export interface MyTask { id: string; title: string; project: string; status: string; priority: string }
export interface MyLeave { id: string; leave_type: string; start_date: string; end_date: string; status: string }
export interface CheckInStatus { checked_in: boolean; check_in_time?: string; duration_minutes?: number }

export interface EmployeeStats {
  attendance_pct: number
  leave_balance: number
  open_tasks: number
  hours_this_week: number
  check_in_status: CheckInStatus
  my_tasks: MyTask[]
  my_leaves: MyLeave[]
  next_holiday?: { name: string; date: string }
  next_deadline?: { title: string; due_date: string; project: string }
}

// ── Service ───────────────────────────────────────────────────────────────────
export const dashboardService = {
  getAdminStats: () =>
    api.get<AdminStats>('/api/dashboard/admin').then((r) => r.data),

  getManagerStats: () =>
    api.get<ManagerStats>('/api/dashboard/manager').then((r) => r.data),

  getEmployeeStats: () =>
    api.get<EmployeeStats>('/api/dashboard/employee').then((r) => r.data),
}
