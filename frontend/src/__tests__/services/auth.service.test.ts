/**
 * Unit tests for auth.service.ts
 * Run: npx vitest run src/__tests__/services/auth.service.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/services/api'
import { authService } from '@/services/auth.service'

vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
    get:  vi.fn(),
  },
}))

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  role: 'employee',
  is_active: true,
}

beforeEach(() => { vi.clearAllMocks() })

describe('authService.login', () => {
  it('returns token and user on success', async () => {
    const mockResponse = { data: { access_token: 'abc123', token_type: 'bearer', user: mockUser } }
    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const result = await authService.login('test@example.com', 'password')

    expect(api.post).toHaveBeenCalledWith('/api/auth/login', { email: 'test@example.com', password: 'password' })
    expect(result.access_token).toBe('abc123')
    expect(result.user.email).toBe('test@example.com')
  })

  it('throws on invalid credentials', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 401, data: { detail: 'Invalid credentials' } } })
    await expect(authService.login('bad@email.com', 'wrong')).rejects.toMatchObject({
      response: { status: 401 },
    })
  })
})

describe('authService.getMe', () => {
  it('returns current user', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockUser })
    const user = await authService.getMe()
    expect(user.email).toBe('test@example.com')
    expect(api.get).toHaveBeenCalledWith('/api/auth/me')
  })
})

describe('authService.changePassword', () => {
  it('calls change-password endpoint', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } })
    await authService.changePassword({ current_password: 'old', new_password: 'new123' })
    expect(api.post).toHaveBeenCalledWith('/api/auth/change-password', {
      current_password: 'old',
      new_password: 'new123',
    })
  })
})
