export interface PayrollEntry {
  id: string
  payroll_run_id?: string
  employee_id: string
  employee_name: string
  employee_code: string
  month: number
  year: number
  department_name?: string
  designation?: string
  bank_account?: string
  basic: number
  hra: number
  travel_allowance: number
  bonus: number
  overtime: number
  gross: number
  pf: number
  tds: number
  esi: number
  lop: number
  other_deductions: number
  total_deductions: number
  net_salary: number
  working_days: number
  paid_days: number
  leave_days: number
  lop_days: number
  status: 'pending' | 'processed' | 'paid'
  paid_on?: string
  has_attendance_warning?: boolean
}

export interface PayrollSummary {
  month: number
  year: number
  is_processed: boolean
  total_amount: number
  total_deductions: number
  processed_count: number
  pending_count: number
  paid_count: number
}

export interface Expense {
  id: string
  user_id: string
  user_name: string
  user_avatar?: string
  title: string
  category: 'travel' | 'meals' | 'equipment' | 'other'
  amount: number
  date: string
  project_id?: string
  project_name?: string
  notes?: string
  receipt_url?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

export interface CreateExpensePayload {
  title: string
  category: Expense['category']
  amount: number
  date: string
  project_id?: string
  notes?: string
}
