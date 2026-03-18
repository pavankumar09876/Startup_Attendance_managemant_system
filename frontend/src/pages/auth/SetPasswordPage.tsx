/**
 * SetPasswordPage — shown on first login when must_change_password = true.
 * Employee cannot skip this step; all other routes redirect here.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'

const PasswordRule = ({ met, label }: { met: boolean; label: string }) => (
  <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${met ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
    {label}
  </li>
)

const SetPasswordPage = () => {
  const navigate         = useNavigate()
  const { user, logout, refreshUser } = useAuth()
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [showPw,   setShowPw]     = useState(false)
  const [showCon,  setShowCon]    = useState(false)

  const rules = {
    length:   password.length >= 8,
    upper:    /[A-Z]/.test(password),
    lower:    /[a-z]/.test(password),
    number:   /\d/.test(password),
    match:    password === confirm && password.length > 0,
  }
  const allValid = Object.values(rules).every(Boolean)

  const { mutate, isPending } = useMutation({
    mutationFn: () => authService.setPassword(password),
    onSuccess: async () => {
      toast.success('Password set! Welcome aboard.')
      await refreshUser()
      navigate(ROUTES.DASHBOARD, { replace: true })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Failed to set password'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!allValid) return
    mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-950/50 p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheck size={28} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set Your Password</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Hi <strong>{user?.first_name}</strong>! Choose a secure password to protect your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type={showCon ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCon((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  {showCon ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Password rules */}
            {password.length > 0 && (
              <ul className="space-y-1 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <PasswordRule met={rules.length} label="At least 8 characters" />
                <PasswordRule met={rules.upper}  label="One uppercase letter" />
                <PasswordRule met={rules.lower}  label="One lowercase letter" />
                <PasswordRule met={rules.number} label="One number" />
                <PasswordRule met={rules.match}  label="Passwords match" />
              </ul>
            )}

            <button
              type="submit"
              disabled={!allValid || isPending}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm
                hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {isPending && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Set Password & Continue
            </button>
          </form>

          {/* Logout link */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            Not you?{' '}
            <button
              onClick={logout}
              className="text-blue-500 hover:underline"
            >
              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SetPasswordPage
