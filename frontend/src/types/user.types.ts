import { ROLES } from '@/constants/roles'

export interface Department {
  id: string
  name: string
  description?: string
  created_at: string
}

export interface User {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: ROLES
  department_id?: string
  department?: Department
  designation?: string
  date_of_joining?: string
  salary?: number
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
  salary?: number
}
