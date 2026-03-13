import api from './api'
import type { TokenResponse, User } from '@/types/user.types'

export const authService = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>('/api/auth/login', { email, password }).then((r) => r.data),

  logout: () =>
    api.post('/api/auth/logout').then((r) => r.data),

  refreshToken: (refresh_token: string) =>
    api.post<TokenResponse>('/api/auth/refresh', { refresh_token }).then((r) => r.data),

  getMe: () =>
    api.get<User>('/api/auth/me').then((r) => r.data),

  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/api/auth/change-password', data).then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, new_password: string) =>
    api.post('/api/auth/reset-password', { token, new_password }).then((r) => r.data),

  setPassword: (new_password: string) =>
    api.post('/api/auth/set-password', { new_password }).then((r) => r.data),
}
