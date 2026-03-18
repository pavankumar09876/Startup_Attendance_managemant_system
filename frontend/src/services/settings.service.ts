import api from './api'
import type { User } from '@/types/user.types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CompanySettings {
  name: string
  logo_url?: string
  industry?: string
  size?: string
  founded_year?: number
  address?: string
  city?: string
  state?: string
  country?: string
  timezone: string
  working_days: number[]    // 0=Mon … 6=Sun
  work_start_time: string   // "09:00"
  work_end_time: string     // "18:00"
}

export interface AttendanceSettings {
  grace_period_minutes: number
  half_day_threshold_hours: number
  overtime_after_hours: number
  geofence_radius_meters: number
  allow_wfh: boolean
  require_selfie: boolean
  auto_mark_absent: boolean
  auto_absent_after_time: string        // "11:00"
  checkin_reminder_time: string         // "09:00"
  checkout_reminder_time: string        // "18:00"
}

export interface LeaveType {
  id: string
  name: string
  days_per_year: number
  carry_forward: boolean
  max_carry_days?: number
  is_paid: boolean
  created_at: string
}

export type PermissionModule = 'attendance' | 'leave' | 'projects' | 'tasks' | 'staff' | 'payroll' | 'reports' | 'settings'
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve'

export type ModulePermissions = Record<PermissionAction, boolean>
export type RolePermissionMap  = Record<PermissionModule, ModulePermissions>

export interface RolePermissions {
  role: string
  permissions: RolePermissionMap
}

export interface NotificationPreferences {
  leave_approved_email: boolean
  leave_approved_inapp: boolean
  leave_rejected_email: boolean
  leave_rejected_inapp: boolean
  task_assigned_email: boolean
  task_assigned_inapp: boolean
  payslip_ready_email: boolean
  payslip_ready_inapp: boolean
  attendance_regularization_inapp: boolean
  checkin_reminder_inapp: boolean
  checkout_reminder_inapp: boolean
  project_deadline_email: boolean
  project_deadline_inapp: boolean
  birthday_reminder_inapp: boolean
}

export interface UpdateProfilePayload {
  first_name?: string
  last_name?: string
  phone?: string
  bio?: string
  avatar_url?: string
}

// ── Service ───────────────────────────────────────────────────────────────────
export const settingsService = {
  // Profile
  updateProfile: (payload: UpdateProfilePayload) =>
    api.patch<User>('/api/auth/me', payload).then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return api
      .post<{ avatar_url: string }>('/api/auth/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  // Company
  getCompanySettings: () =>
    api.get<CompanySettings>('/api/settings/company').then((r) => r.data),

  updateCompanySettings: (payload: Partial<CompanySettings>) =>
    api.patch<CompanySettings>('/api/settings/company', payload).then((r) => r.data),

  uploadCompanyLogo: (file: File) => {
    const form = new FormData()
    form.append('logo', file)
    return api
      .post<{ logo_url: string }>('/api/settings/company/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  // Attendance
  getAttendanceSettings: () =>
    api.get<AttendanceSettings>('/api/settings/attendance').then((r) => r.data),

  updateAttendanceSettings: (payload: Partial<AttendanceSettings>) =>
    api.patch<AttendanceSettings>('/api/settings/attendance', payload).then((r) => r.data),

  // Leave types
  getLeaveTypes: () =>
    api.get<LeaveType[]>('/api/settings/leave-types').then((r) => r.data),

  createLeaveType: (payload: Omit<LeaveType, 'id' | 'created_at'>) =>
    api.post<LeaveType>('/api/settings/leave-types', payload).then((r) => r.data),

  updateLeaveType: (id: string, payload: Partial<LeaveType>) =>
    api.patch<LeaveType>(`/api/settings/leave-types/${id}`, payload).then((r) => r.data),

  deleteLeaveType: (id: string) =>
    api.delete(`/api/settings/leave-types/${id}`).then((r) => r.data),

  // Roles & Permissions
  getRolePermissions: (role: string) =>
    api.get<RolePermissions>(`/api/settings/permissions/${role}`).then((r) => r.data),

  updateRolePermissions: (role: string, permissions: RolePermissionMap) =>
    api
      .put<RolePermissions>(`/api/settings/permissions/${role}`, { permissions })
      .then((r) => r.data),

  // Notifications
  getNotificationPreferences: () =>
    api.get<NotificationPreferences>('/api/settings/notifications').then((r) => r.data),

  updateNotificationPreferences: (payload: Partial<NotificationPreferences>) =>
    api.patch<NotificationPreferences>('/api/settings/notifications', payload).then((r) => r.data),
}
