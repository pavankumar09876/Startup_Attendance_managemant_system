import api from './api'
import type { LoginPayload, TokenResponse, User } from '@/types/user.types'

export const authService = {
  login: (payload: LoginPayload) =>
    api.post<TokenResponse>('/api/auth/login', payload).then((r) => r.data),

  me: () =>
    api.get<User>('/api/auth/me').then((r) => r.data),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    api.post('/api/auth/change-password', payload).then((r) => r.data),
}
