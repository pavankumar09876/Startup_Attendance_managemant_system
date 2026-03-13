import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'

import { authService } from '@/services/auth.service'
import { ROUTES } from '@/constants/routes'
import Button from '@/components/common/Button'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type FormData = z.infer<typeof schema>

const ForgotPasswordPage = () => {
  const [sent, setSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate, isPending } = useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onSuccess: (_, email) => {
      setSubmittedEmail(email)
      setSent(true)
      setErrorMsg('')
    },
    onError: (err: any) => {
      setErrorMsg(
        err?.response?.data?.detail ?? 'Something went wrong. Please try again.',
      )
    },
  })

  const onSubmit = (data: FormData) => {
    setErrorMsg('')
    mutate(data.email)
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
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-[400px]">
          <Link
            to={ROUTES.LOGIN}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>

          {/* ── Success state ── */}
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-1">
                We've sent a password reset link to
              </p>
              <p className="text-sm font-medium text-gray-800 mb-6">{submittedEmail}</p>
              <p className="text-xs text-gray-400 mb-6">
                Didn't receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="text-blue-600 hover:underline"
                >
                  try again
                </button>
                .
              </p>
              <Link
                to={ROUTES.LOGIN}
                className="inline-flex items-center justify-center w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h2 className="text-2xl font-semibold text-gray-900 mb-1">Forgot password?</h2>
              <p className="text-sm text-gray-500 mb-7">
                No worries — enter your email and we'll send you a reset link.
              </p>

              {errorMsg && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

                <Button
                  type="submit"
                  loading={isPending}
                  disabled={isPending}
                  className="w-full py-2.5 text-[15px]"
                >
                  {isPending ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
