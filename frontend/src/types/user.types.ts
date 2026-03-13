import { ROLES } from '@/constants/roles'

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'
export type WorkLocation   = 'office' | 'remote' | 'hybrid'

export interface Department {
  id: string
  name: string
  description?: string
  type?: 'IT' | 'Non-IT' | 'Other'
  head_id?: string
  head_name?: string
  employee_count?: number
  created_at: string
}

export interface User {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  full_name?: string
  email: string
  phone?: string
  date_of_birth?: string
  address?: string
  emergency_contact?: string
  role: ROLES
  department_id?: string
  department?: Department
  department_name?: string
  designation?: string
  manager_id?: string
  manager_name?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  work_location?: WorkLocation
  salary?: number
  hra?: number
  allowances?: number
  deductions?: number
  bank_account?: string
  ifsc_code?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface CreateUserPayload {
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  password: string
  role: ROLES
  department_id?: string
  designation?: string
  manager_id?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  work_location?: WorkLocation
  date_of_birth?: string
  salary?: number
  hra?: number
  allowances?: number
  bank_account?: string
  ifsc_code?: string
  send_welcome_email?: boolean
}

export interface PaginatedUsers {
  users: User[]
  total: number
}

export interface EmployeeFilters {
  search?: string
  department_id?: string
  role?: string
  is_active?: boolean
  limit?: number
  skip?: number
}

export interface Payslip {
  id: string
  employee_id: string
  month: number
  year: number
  basic: number
  hra: number
  allowances: number
  deductions: number
  net_salary: number
  status: 'draft' | 'processed' | 'paid'
  paid_on?: string
  created_at: string
}
