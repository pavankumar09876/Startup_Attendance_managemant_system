import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Camera, Eye, EyeOff, Lock } from 'lucide-react'

import { settingsService } from '@/services/settings.service'
import { authService }     from '@/services/auth.service'
import { useAuth }         from '@/hooks/useAuth'
import Button              from '@/components/common/Button'
import { cn }              from '@/utils/cn'

const profileSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name:  z.string().min(1, 'Required'),
  phone:      z.string().optional(),
  bio:        z.string().max(300, 'Max 300 chars').optional(),
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password:     z.string().min(8, 'Min 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type ProfileForm   = z.infer<typeof profileSchema>
type PasswordForm  = z.infer<typeof passwordSchema>

const inputCls = cn(
  'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-blue-500',
)

const MyProfileSettings = () => {
  const { user, setUser } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    reset: resetProfile,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) })

  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    formState: { errors: pwdErrors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  useEffect(() => {
    if (user) {
      resetProfile({
        first_name: user.first_name ?? '',
        last_name:  user.last_name  ?? '',
        phone:      user.phone      ?? '',
        bio:        (user as any).bio ?? '',
      })
    }
  }, [user, resetProfile])

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const { mutate: uploadAvatar, isPending: uploadingAvatar } = useMutation({
    mutationFn: (file: File) => settingsService.uploadAvatar(file),
    onSuccess: (data) => {
      toast.success('Avatar updated!')
      if (user) setUser({ ...user, avatar_url: data.avatar_url })
      setAvatarFile(null)
    },
    onError: () => toast.error('Avatar upload failed'),
  })

  const handleAvatarChange = (file: File) => {
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setAvatarPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ── Profile save ───────────────────────────────────────────────────────────
  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: async (data: ProfileForm) => {
      if (avatarFile) await uploadAvatar(avatarFile)
      return settingsService.updateProfile(data)
    },
    onSuccess: (updated) => {
      toast.success('Profile saved!')
      if (user) setUser({ ...user, ...updated })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Save failed'),
  })

  // ── Password change ────────────────────────────────────────────────────────
  const { mutate: changePwd, isPending: changingPwd } = useMutation({
    mutationFn: (data: PasswordForm) =>
      authService.changePassword({ current_password: data.current_password, new_password: data.new_password }),
    onSuccess: () => {
      toast.success('Password changed!')
      resetPwd()
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Incorrect current password'),
  })

  const displayAvatar = avatarPreview ?? user?.avatar_url
  const initials      = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ── Avatar ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Profile Picture</h3>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div
              className="w-20 h-20 rounded-full overflow-hidden cursor-pointer ring-2 ring-gray-200 ring-offset-2"
              onClick={() => fileRef.current?.click()}
            >
              {displayAvatar ? (
                <img src={displayAvatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center
                opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleAvatarChange(e.target.files[0])}
          />
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Change photo
            </button>
            {avatarFile && (
              <p className="text-xs text-gray-500 mt-1">
                {avatarFile.name} — click Save to upload
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF. Max 2MB.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* ── Personal info ────────────────────────────────────────── */}
      <form onSubmit={handleProfile((d) => saveProfile(d))} className="space-y-5">
        <h3 className="text-sm font-semibold text-gray-800">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
            <input {...regProfile('first_name')} className={inputCls} />
            {profileErrors.first_name && (
              <p className="text-xs text-red-500 mt-0.5">{profileErrors.first_name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
            <input {...regProfile('last_name')} className={inputCls} />
            {profileErrors.last_name && (
              <p className="text-xs text-red-500 mt-0.5">{profileErrors.last_name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className={cn(inputCls, 'bg-gray-50 text-gray-400 cursor-not-allowed')}
            />
            <p className="text-xs text-gray-400 mt-0.5">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input {...regProfile('phone')} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
          <textarea
            rows={3}
            {...regProfile('bio')}
            placeholder="Tell us a little about yourself…"
            className={cn(inputCls, 'resize-none')}
          />
          {profileErrors.bio && (
            <p className="text-xs text-red-500 mt-0.5">{profileErrors.bio.message}</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={savingProfile || uploadingAvatar}
            disabled={!profileDirty && !avatarFile}
          >
            Save Changes
          </Button>
        </div>
      </form>

      <div className="border-t border-gray-100" />

      {/* ── Change password ──────────────────────────────────────── */}
      <form onSubmit={handlePwd((d) => changePwd(d))} className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={15} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800">Change Password</h3>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
          <div className="relative">
            <input
              type={showOld ? 'text' : 'password'}
              {...regPwd('current_password')}
              className={cn(inputCls, 'pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowOld((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {pwdErrors.current_password && (
            <p className="text-xs text-red-500 mt-0.5">{pwdErrors.current_password.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                {...regPwd('new_password')}
                className={cn(inputCls, 'pr-10')}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwdErrors.new_password && (
              <p className="text-xs text-red-500 mt-0.5">{pwdErrors.new_password.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                {...regPwd('confirm_password')}
                className={cn(inputCls, 'pr-10')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwdErrors.confirm_password && (
              <p className="text-xs text-red-500 mt-0.5">{pwdErrors.confirm_password.message}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={changingPwd}>
            Update Password
          </Button>
        </div>
      </form>
    </div>
  )
}

export default MyProfileSettings
