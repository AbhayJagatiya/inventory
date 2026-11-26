import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  User, Building2, Shield, KeyRound, CheckCircle2,
  AlertCircle, Lock, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { changePassword } from '../../api/auth.api'
import { extractApiError } from '../../api/client'
import PageHeader from '../../components/layout/PageHeader'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import toast from 'react-hot-toast'
import { ROLE_LABELS } from '../../constants/enums'
import { useLanguage } from '../../i18n'
import { translateEnum } from '../../i18n/enumLabels'
import { useMemo } from 'react'

function MyProfilePage() {
  const { user, userRole, officeName } = useAuth()
  const { t } = useLanguage()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')

  const passwordSchema = useMemo(() => z.object({
    current_password: z.string().min(1, t('validation.required')),
    new_password: z.string().min(8, t('validation.passwordMin', { min: 8 })),
    confirm_password: z.string().min(1, t('validation.required')),
  }).refine((data) => data.new_password === data.confirm_password, {
    message: t('validation.passwordMatch'),
    path: ['confirm_password'],
  }), [t])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
  })

  const onSubmitPassword = async (data) => {
    setApiError('')
    try {
      await changePassword(data)
      toast.success(t('profile.messages.passwordChanged'))
      reset()
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.sections.security')}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm text-center">
          <div className="w-20 h-20 rounded-2xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-sm">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">{user?.full_name || 'Store User'}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{user?.designation || 'Staff Member'}</p>
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20">
              {translateEnum(t, typeof userRole === 'string' ? userRole : (userRole?.name || 'STORE_STAFF'))}
            </span>
          </div>

          <div className="border-t border-slate-100 dark:border-emerald-500/10 pt-4 space-y-2.5 text-left text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('labels.username')}:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{user?.username || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('profile.officeLabel')}:</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{officeName || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{t('labels.status')}:</span>
              <StatusBadge status="ACTIVE" size="xs" />
            </div>
          </div>
        </div>

        {/* Permissions & Security */}
        <div className="md:col-span-2 space-y-6">
          {/* Change Password Form */}
          <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-emerald-500/10">
              <KeyRound size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Change Account Password</h2>
            </div>

            {apiError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 mb-4 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle size={14} className="shrink-0" />
                <span>{apiError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmitPassword)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('profile.form.currentPassword')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('current_password')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('profile.form.currentPassword')}
                />
                {errors.current_password && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.current_password.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('profile.form.newPassword')}</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('new_password')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder={t('validation.passwordMin', { min: 8 })}
                  />
                  {errors.new_password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.new_password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('profile.form.confirmNewPassword')}</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('confirm_password')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-emerald-500/25 rounded-xl bg-white dark:bg-[#0A1513] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder={t('profile.form.confirmNewPassword')}
                  />
                  {errors.confirm_password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{errors.confirm_password.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showPassword ? '👁‍🗨' : '👁'}</span>
                </button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                  {t('actions.saveChanges')}
                </Button>
              </div>
            </form>
          </div>

          {/* Assigned Permissions Summary */}
          <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-emerald-500/10">
              <Shield size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">{t('labels.permissions')}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Permissions are authoritative and enforced on the backend per each API request.
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto scrollbar-thin">
              {user?.permissions?.length > 0 ? (
                user.permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-slate-100 dark:bg-[#081210] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-emerald-500/20"
                  >
                    {perm}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">Standard operational permissions loaded per role.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MyProfilePage

