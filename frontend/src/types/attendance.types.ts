export type AttendanceStatus =
  | 'present' | 'absent' | 'late'
  | 'half_day' | 'on_leave' | 'holiday' | 'weekend'

export interface Attendance {
  id: string
  employee_id: string
  date: string
  check_in?: string
  check_out?: string
  status: AttendanceStatus
  working_hours?: number
  overtime_hours?: number
  notes?: string
  created_at: string
}

export interface AttendanceSummary {
  total_days: number
  present: number
  absent: number
  late: number
  half_day: number
  on_leave: number
  avg_working_hours: number
}
