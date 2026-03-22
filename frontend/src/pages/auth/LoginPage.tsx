import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft,
  Shield, Zap, BarChart2, Users, Clock, Fingerprint,
} from 'lucide-react'

import type { AxiosError } from 'axios'
import { authService } from '@/services/auth.service'
import { useAuth, ROLE_REDIRECT } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'
import Button from '@/components/common/Button'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

const TRUST_BADGES = [
  { icon: <Shield size={14} />, text: '256-bit SSL Encrypted' },
  { icon: <Fingerprint size={14} />, text: 'SOC-2 Compliant' },
  { icon: <Zap size={14} />, text: '99.9% Uptime' },
]

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [focused, setFocused] = useState<string | null>(null)
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
      setAuth(data.user, data.access_token, data.refresh_token)
      toast.success(`Welcome back, ${data.user.first_name}!`)
      const redirect = ROLE_REDIRECT[data.user.role] ?? ROUTES.DASHBOARD
      navigate(redirect, { replace: true })
    },
    onError: (err: AxiosError<{ detail: string }>) => {
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
    <div className="min-h-screen flex bg-[#060B18]">

      {/* ── Left panel — immersive branding ─────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-violet-800" />

        {/* Floating orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-32 right-16 w-96 h-96 bg-violet-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Top — Logo + back */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20">
                <span className="text-white font-bold text-xl tracking-tight">WP</span>
              </div>
              <div>
                <span className="text-white font-bold text-xl">Workforce Pro</span>
                <div className="text-blue-200/70 text-xs">Enterprise HR Platform</div>
              </div>
            </div>
            <Link
              to={ROUTES.HOME}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <ArrowLeft size={16} />
              Back to Home
            </Link>
          </div>

          {/* Center — Hero content */}
          <div className="max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Welcome back to your{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-blue-200 bg-clip-text text-transparent">
                command center
              </span>
            </h1>
            <p className="text-blue-100/70 text-lg leading-relaxed mb-10">
              Access your dashboard, manage your team, and stay on top of everything
              — all in one place.
            </p>

            {/* Floating stat cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <Users size={18} />, value: '2,400+', label: 'Active Users Today', accent: 'from-cyan-400/20 to-cyan-400/5' },
                { icon: <Clock size={18} />, value: '98.7%', label: 'On-Time Rate', accent: 'from-emerald-400/20 to-emerald-400/5' },
                { icon: <BarChart2 size={18} />, value: '156', label: 'Reports Generated', accent: 'from-violet-400/20 to-violet-400/5' },
                { icon: <Zap size={18} />, value: '<200ms', label: 'Avg Response Time', accent: 'from-amber-400/20 to-amber-400/5' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className={`bg-gradient-to-br ${stat.accent} backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all`}
                >
                  <div className="text-white/60 mb-2">{stat.icon}</div>
                  <div className="text-white text-xl font-bold">{stat.value}</div>
                  <div className="text-blue-200/50 text-xs mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom — Footer */}
          <p className="text-blue-200/30 text-xs">
            &copy; {new Date().getFullYear()} Workforce Pro. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile header */}
          <div className="flex items-center justify-between mb-10 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">WP</span>
              </div>
              <span className="text-lg font-bold text-white">Workforce Pro</span>
            </div>
            <Link
              to={ROUTES.HOME}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Sign in to your account</h2>
            <p className="text-gray-400 text-sm">
              Enter your credentials to access your workspace
            </p>
          </div>

          {/* Error alert */}
          {errorMsg && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3.5 mb-6 text-sm backdrop-blur-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                focused === 'email'
                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white/[0.03]'
                  : errors.email
                    ? 'border-red-500/50 bg-white/[0.02]'
                    : 'border-gray-700/80 bg-white/[0.02] hover:border-gray-600'
              }`}>
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  placeholder="you@company.com"
                  disabled={isPending}
                  onFocus={() => setFocused('email')}
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
                  {...register('email', { onBlur: () => setFocused(null) })}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                focused === 'password'
                  ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white/[0.03]'
                  : errors.password
                    ? 'border-red-500/50 bg-white/[0.02]'
                    : 'border-gray-700/80 bg-white/[0.02] hover:border-gray-600'
              }`}>
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  disabled={isPending}
                  onFocus={() => setFocused('password')}
                  className="w-full pl-11 pr-12 py-3.5 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
                  {...register('password', { onBlur: () => setFocused(null) })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 text-sm text-gray-400 cursor-pointer select-none group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    {...register('remember')}
                  />
                  <div className="w-[18px] h-[18px] rounded-md border border-gray-600 bg-white/5 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                    <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <span className="group-hover:text-gray-300 transition-colors">Remember me</span>
              </label>
              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              loading={isPending}
              disabled={isPending}
              className="w-full py-3.5 text-[15px] rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-xl shadow-blue-600/20 transition-all duration-200"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#060B18] px-4 text-gray-500">Secured by enterprise-grade encryption</span>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6">
            {TRUST_BADGES.map((badge, i) => (
              <div key={i} className="flex items-center gap-1.5 text-gray-500">
                {badge.icon}
                <span className="text-[11px]">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
