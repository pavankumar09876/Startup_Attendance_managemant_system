import api from './api'

// ── Attendance ────────────────────────────────────────────────────────────────
export interface AttendanceTrendPoint {
  date: string
  present: number
  absent: number
  late: number
}

export interface DeptAttendanceStat {
  department: string
  present_pct: number
  absent_pct: number
  late_pct: number
}

export interface HeatmapCell {
  date: string
  day: number   // 0=Mon … 6=Sun
  week: number  // week index
  status: 'on_time' | 'slight_late' | 'very_late' | 'absent' | 'weekend'
  arrival_time?: string
}

export interface AttendanceSummaryRow {
  employee_id: string
  employee_name: string
  department: string
  total_days: number
  present: number
  absent: number
  late: number
  wfh: number
  leave: number
  attendance_pct: number
}

export interface AttendanceReportData {
  trend: AttendanceTrendPoint[]
  by_department: DeptAttendanceStat[]
  heatmap: HeatmapCell[]
  summary: AttendanceSummaryRow[]
}

// ── Projects ──────────────────────────────────────────────────────────────────
export interface ProjectProgressRow {
  id: string
  name: string
  status: string
  progress: number
  budget: number
  spent: number
  tasks_done: number
  tasks_total: number
  team_count: number
  health: 'on_track' | 'at_risk' | 'delayed'
}

export interface TaskTrendPoint {
  date: string
  [project: string]: number | string
}

export interface ProjectReportData {
  projects: ProjectProgressRow[]
  budget_chart: { name: string; budget: number; spent: number }[]
  task_trend: TaskTrendPoint[]
}

// ── Team Utilization ──────────────────────────────────────────────────────────
export interface TeamUtilizationRow {
  employee_id: string
  employee_name: string
  department: string
  hours_logged: number
  expected_hours: number
  utilization_pct: number
  projects_count: number
  tasks_done: number
  avg_daily_hours: number
}

export interface ProjectAllocation {
  project: string
  hours: number
}

export interface ProductivityPoint {
  week: string
  tasks_completed: number
}

export interface TeamReportData {
  utilization: TeamUtilizationRow[]
  allocation: ProjectAllocation[]
  productivity_trend: ProductivityPoint[]
}

// ── Payroll ───────────────────────────────────────────────────────────────────
export interface MonthlyPayrollPoint {
  month: string
  total_basic: number
  total_deductions: number
  net_payout: number
  employee_count: number
}

export interface DeptCostBreakdown {
  department: string
  amount: number
}

export interface SalaryGrowthPoint {
  month: string
  [role: string]: number | string
}

export interface PayrollReportRow {
  month: string
  year: number
  employee_count: number
  total_basic: number
  total_deductions: number
  net_payout: number
  status: 'processed' | 'pending'
}

export interface PayrollReportData {
  monthly: MonthlyPayrollPoint[]
  by_department: DeptCostBreakdown[]
  salary_growth: SalaryGrowthPoint[]
  rows: PayrollReportRow[]
}

// ── Service ───────────────────────────────────────────────────────────────────
export interface AttendanceReportFilters {
  start_date?: string
  end_date?: string
  department_id?: string
  employee_id?: string
}

export const reportsService = {
  getAttendanceReport: (filters?: AttendanceReportFilters) =>
    api
      .get<AttendanceReportData>('/api/reports/attendance', { params: filters })
      .then((r) => r.data),

  getProjectReport: (filters?: { project_id?: string; status?: string; start_date?: string; end_date?: string }) =>
    api
      .get<ProjectReportData>('/api/reports/projects', { params: filters })
      .then((r) => r.data),

  getTeamReport: (filters?: { employee_id?: string; month?: number; year?: number }) =>
    api
      .get<TeamReportData>('/api/reports/team', { params: filters })
      .then((r) => r.data),

  getPayrollReport: (filters?: { year?: number }) =>
    api
      .get<PayrollReportData>('/api/reports/payroll', { params: filters })
      .then((r) => r.data),

  exportCSV: (type: 'attendance' | 'projects' | 'team' | 'payroll', params?: Record<string, unknown>) =>
    api
      .get(`/api/reports/${type}/export`, { params, responseType: 'blob' })
      .then((r) => r.data as Blob),

  exportPDF: (type: 'attendance' | 'projects' | 'team' | 'payroll', params?: Record<string, unknown>) =>
    api
      .get(`/api/reports/${type}/export-pdf`, { params, responseType: 'blob' })
      .then((r) => r.data as Blob),
}
