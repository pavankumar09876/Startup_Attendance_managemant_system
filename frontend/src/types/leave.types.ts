export type LeaveType =
  | 'annual' | 'sick' | 'casual'
  | 'maternity' | 'paternity' | 'unpaid'

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Leave {
  id: string
  employee_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: LeaveStatus
  reviewed_by?: string
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
}

export interface LeaveCreatePayload {
  leave_type: LeaveType
  start_date: string
  end_date: string
  reason: string
}
