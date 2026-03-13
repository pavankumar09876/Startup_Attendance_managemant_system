export enum ROLES {
  SUPER_ADMIN = 'super_admin',
  ADMIN       = 'admin',
  HR          = 'hr',
  MANAGER     = 'manager',
  EMPLOYEE    = 'employee',
}

export const ROLE_LABELS: Record<ROLES, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]:       'Admin',
  [ROLES.HR]:          'HR',
  [ROLES.MANAGER]:     'Manager',
  [ROLES.EMPLOYEE]:    'Employee',
}

export const ROLE_COLORS: Record<ROLES, string> = {
  [ROLES.SUPER_ADMIN]: 'bg-purple-100 text-purple-700',
  [ROLES.ADMIN]:       'bg-blue-100 text-blue-700',
  [ROLES.HR]:          'bg-pink-100 text-pink-700',
  [ROLES.MANAGER]:     'bg-orange-100 text-orange-700',
  [ROLES.EMPLOYEE]:    'bg-gray-100 text-gray-700',
}
