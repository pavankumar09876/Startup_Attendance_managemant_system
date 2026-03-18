export type AttendanceStatus =
  | 'present' | 'absent' | 'late'
  | 'half_day' | 'on_leave' | 'holiday' | 'weekend' | 'wfh'

export interface Attendance {
  id: string
  employee_id: string
  date: string
  check_in?: string
  check_out?: string
  break_start?: string
  break_end?: string
  break_minutes?: number
  on_break?: boolean
  status: AttendanceStatus
  working_hours?: number
  overtime_hours?: number
  shift_id?: string
  notes?: string
  location?: 'office' | 'remote'
  created_at: string
}

export interface Shift {
  id: string
  name: string
  start_time: string   // "HH:MM"
  end_time: string     // "HH:MM"
  grace_minutes: number
  is_night_shift: boolean
  is_active: boolean
  created_at: string
}

export interface AttendanceSummary {
  working_days: number
  present: number
  absent: number
  late: number
  half_day: number
  on_leave: number
  wfh: number
  avg_working_hours: number
}

export interface TodayStatus {
  checked_in: boolean
  check_in_time?: string    // "HH:MM:SS"
  check_out_time?: string
  working_hours?: number
  status?: AttendanceStatus
  location?: 'office' | 'remote'
  on_break?: boolean
  break_minutes?: number
}

export interface Regularization {
  id: string
  employee_id: string
  employee_name?: string
  date: string
  check_in: string
  check_out: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface TeamAttendanceRecord extends Attendance {
  employee_name: string
  employee_avatar?: string
  department: string
}

export interface TeamAttendanceFilters {
  department?: string
  date_from?: string
  date_to?: string
  status?: string
  search?: string
  skip?: number
  limit?: number
}

export interface TeamAttendanceSummary {
  total: number
  present: number
  absent: number
  late: number
  wfh: number
}
