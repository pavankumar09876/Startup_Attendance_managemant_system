import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'

import { authService } from '@/services/auth.service'
import { ROUTES } from '@/constants/routes'
import Button from '@/components/common/Button'
import { cn } from '@/utils/cn'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })
type FormData = z.infer<typeof schema>

// ── Password strength ─────────────────────────────────────────────────────────
type Strength = 'weak' | 'medium' | 'strong'

const getStrength = (pwd: string): { level: Strength; score: number; label: string } => {
  let score = 0
  if (pwd.length >= 8)  score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++

  if (score <= 2) return { level: 'weak',   score, label: 'Weak' }
  if (score <= 3) return { level: 'medium', score, label: 'Medium' }
  return              { level: 'strong',  score, label: 'Strong' }
}

const strengthConfig: Record<Strength, { bars: number; color: string; textColor: string }> = {
  weak:   { bars: 1, color: 'bg-red-400',    textColor: 'text-red-500' },
  medium: { bars: 2, color: 'bg-yellow-400', textColor: 'text-yellow-600' },
  strong: { bars: 3, color: 'bg-green-500',  textColor: 'text-green-600' },
}

const StrengthIndicator = ({ password }: { password: string }) => {
  if (!password) return null
  const { level, label } = getStrength(password)
  const { bars, color, textColor } = strengthConfig[level]

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              i <= bars ? color : 'bg-gray-200 dark:bg-gray-700',
            )}
          />
        ))}
      </div>
      <p className={cn('text-xs font-medium', textColor)}>
        Password strength: {label}
      </p>
    </div>
  )
}

// ── Requirements checklist ────────────────────────────────────────────────────
const REQUIREMENTS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number',            test: (p: string) => /[0-9]/.test(p) },
]

const RequirementItem = ({ met, label }: { met: boolean; label: string }) => (
  <li className={cn('flex items-center gap-1.5 text-xs', met ? 'text-green-600' : 'text-gray-400 dark:text-gray-500')}>
    <CheckCircle size={12} className={met ? 'text-green-500' : 'text-gray-300'} />
    {label}
  </li>
)

// ── Page ──────────────────────────────────────────────────────────────────────
const ResetPasswordPage = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [errorMsg, setErrorMsg]         = useState('')
  const [searchParams]                  = useSearchParams()
  const navigate                        = useNavigate()

  const token = searchParams.get('token') ?? ''

  // Redirect if no token present
  useEffect(() => {
    if (!token) navigate(ROUTES.FORGOT_PASSWORD, { replace: true })
  }, [token, navigate])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const passwordValue = watch('password', '')

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => authService.resetPassword(token, data.password),
    onSuccess: () => {
      toast.success('Password reset successfully! Please sign in.')
      navigate(ROUTES.LOGIN, { replace: true })
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.response?.data?.detail ??
          'Reset link is invalid or expired. Please request a new one.',
      )
    },
  })

  const onSubmit = (data: FormData) => {
    setErrorMsg('')
    mutate(data)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] flex-col items-center justify-center p-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-2xl">WP</span>
          </div>
          <h1 className="text-white text-3xl font-bold mb-3">Workforce Pro</h1>
          <p className="text-slate-400 text-base">Manage your team, smarter.</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white dark:bg-gray-900">
        <div className="w-full max-w-[400px]">
          <Link
            to={ROUTES.LOGIN}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-8 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>

          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Set new password</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-7">
            Your new password must be different from your previous one.
          </p>

          {errorMsg && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                New password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={isPending}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    disabled:bg-gray-50 disabled:cursor-not-allowed
                    dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:disabled:bg-gray-800
                    ${errors.password ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength indicator */}
              <StrengthIndicator password={passwordValue} />

              {/* Requirements */}
              {passwordValue && (
                <ul className="mt-2 space-y-1">
                  {REQUIREMENTS.map((r) => (
                    <RequirementItem key={r.label} met={r.test(passwordValue)} label={r.label} />
                  ))}
                </ul>
              )}

              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <Lock size={16} />
                </span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={isPending}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    disabled:bg-gray-50 disabled:cursor-not-allowed
                    dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:disabled:bg-gray-800
                    ${errors.confirm ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                  {...register('confirm')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm && (
                <p className="mt-1 text-xs text-red-500">{errors.confirm.message}</p>
              )}
            </div>

            <Button
              type="submit"
              loading={isPending}
              disabled={isPending}
              className="w-full py-2.5 text-[15px]"
            >
              {isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
