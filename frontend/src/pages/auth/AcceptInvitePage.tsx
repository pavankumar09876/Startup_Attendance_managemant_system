import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2, Briefcase } from 'lucide-react'
import { onboardingService } from '@/services/onboarding.service'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'
import Button from '@/components/common/Button'
import toast from 'react-hot-toast'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One digit', test: (p: string) => /\d/.test(p) },
]

const AcceptInvitePage = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { login } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allRulesPass = PASSWORD_RULES.every((r) => r.test(password))
  const passwordsMatch = password === confirm && password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Invalid invite link. No token provided.')
      return
    }
    if (!allRulesPass) {
      setError('Password does not meet requirements.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await onboardingService.acceptInvite(token, password)
      login(data.user, data.access_token, data.refresh_token)
      toast.success('Welcome! Your account is now active.')
      navigate(ROUTES.DASHBOARD)
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        'Failed to accept invite. The link may have expired.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Invalid Invite Link</h2>
          <p className="text-sm text-gray-500 mb-4">
            This invite link is invalid or missing a token. Please check your email for the correct link.
          </p>
          <Button onClick={() => navigate(ROUTES.LOGIN)}>Go to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="card p-8 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Workforce Pro</h1>
            <p className="text-xs text-gray-500">Accept your invite</p>
          </div>
        </div>

        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Set Your Password
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Create a secure password to activate your account.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-10"
                placeholder="Create a password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Password rules */}
          <div className="space-y-1.5">
            {PASSWORD_RULES.map((rule) => (
              <div
                key={rule.label}
                className={`flex items-center gap-2 text-xs ${
                  password.length === 0
                    ? 'text-gray-400'
                    : rule.test(password)
                    ? 'text-green-600'
                    : 'text-red-500'
                }`}
              >
                <CheckCircle2 size={12} />
                {rule.label}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input w-full"
              placeholder="Re-enter your password"
            />
            {confirm && !passwordsMatch && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <Button
            type="submit"
            loading={loading}
            disabled={!allRulesPass || !passwordsMatch}
            className="w-full"
          >
            Activate Account
          </Button>
        </form>
      </div>
    </div>
  )
}

export default AcceptInvitePage
