import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Mail, Lock, Eye, EyeOff, Users, BarChart2,
  Clock, CheckCircle, AlertCircle,
} from 'lucide-react'

import { authService } from '@/services/auth.service'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'
import { ROLES } from '@/constants/roles'
import Button from '@/components/common/Button'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

const ROLE_REDIRECT: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: ROUTES.DASHBOARD,
  [ROLES.ADMIN]:       ROUTES.DASHBOARD,
  [ROLES.HR]:          ROUTES.DASHBOARD,
  [ROLES.MANAGER]:     ROUTES.PROJECTS,
  [ROLES.EMPLOYEE]:    ROUTES.ATTENDANCE,
}

const FEATURES = [
  { icon: <Users size={16} />,    text: 'Manage your entire workforce' },
  { icon: <Clock size={16} />,    text: 'Real-time attendance tracking' },
  { icon: <BarChart2 size={16} />, text: 'Insightful reports & analytics' },
  { icon: <CheckCircle size={16} />, text: 'Project & task management' },
]

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const { setAuth } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate, isPending } = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: (data) => {
      setErrorMsg('')
      setAuth(data.user, data.access_token)
      toast.success(`Welcome back, ${data.user.first_name}!`)
      const redirect = ROLE_REDIRECT[data.user.role] ?? ROUTES.DASHBOARD
      navigate(redirect, { replace: true })
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ?? 'Invalid email or password. Please try again.'
      setErrorMsg(msg)
    },
  })

  const onSubmit = (data: FormData) => {
    setErrorMsg('')
    mutate({ email: data.email, password: data.password })
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — dark branding ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] flex-col justify-between p-12">
        {/* Monogram + name */}
        <div>
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6">
            <span className="text-white font-bold text-2xl tracking-tight">WP</span>
          </div>
          <h1 className="text-white text-3xl font-bold mb-2">Workforce Pro</h1>
          <p className="text-slate-400 text-lg">Manage your team, smarter.</p>
        </div>

        {/* Feature list */}
        <div className="space-y-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-slate-300">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-blue-400">
                {f.icon}
              </div>
              <span className="text-sm">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-slate-600 text-xs">
          © {new Date().getFullYear()} Workforce Pro. All rights reserved.
        </p>
      </div>

      {/* ── Right panel — login form ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">WP</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">Workforce Pro</span>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-7">
            Enter your credentials to access your account
          </p>

          {/* Error alert */}
          {errorMsg && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  placeholder="you@company.com"
                  disabled={isPending}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    disabled:bg-gray-50 disabled:cursor-not-allowed
                    ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={isPending}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    disabled:bg-gray-50 disabled:cursor-not-allowed
                    ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  {...register('remember')}
                />
                Remember me
              </label>
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              loading={isPending}
              disabled={isPending}
              className="w-full py-2.5 text-[15px]"
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
