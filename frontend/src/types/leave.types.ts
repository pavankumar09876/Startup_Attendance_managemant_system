export type LeaveType =
  | 'casual' | 'sick' | 'earned' | 'comp_off' | 'unpaid'
  | 'maternity' | 'paternity'

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Leave {
  id: string
  employee_id: string
  employee_name?: string
  employee_avatar?: string
  department?: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  total_days: number
  reason: string
  is_half_day?: boolean
  half_day_period?: 'am' | 'pm'
  status: LeaveStatus
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
}

export interface LeaveBalance {
  leave_type: LeaveType
  total: number
  used: number
  remaining: number
}

export interface LeaveCreatePayload {
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string
  is_half_day?: boolean
  half_day_period?: 'am' | 'pm'
}

export interface Holiday {
  id: string
  name: string
  date: string         // yyyy-MM-dd
  type: 'public' | 'company'
  description?: string
}

export interface LeaveApprovalFilters {
  status?: string
  department?: string
  skip?: number
  limit?: number
}
