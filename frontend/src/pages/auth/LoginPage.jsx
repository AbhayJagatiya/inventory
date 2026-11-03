import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { extractApiError } from '../../api/client'
import AuthLayout from '../../components/layout/AuthLayout'
import Button from '../../components/common/Button'
import { cn } from '../../utils/cn'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

function LoginPage() {
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [apiError, setApiError] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data) => {
    setApiError('')
    try {
      await login(data)
    } catch (err) {
      setApiError(extractApiError(err))
    }
  }

  return (
    <AuthLayout>
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-800 px-8 py-6 text-center">
          {/* Emblem placeholder */}
          <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-white">GS</span>
          </div>
          <h1 className="text-white font-semibold text-base leading-tight">
            Dead Stock Inventory Management
          </h1>
          <p className="text-blue-200 text-xs mt-1">
            District Development Office – Gir Somnath
          </p>
          <p className="text-blue-300 text-[11px] mt-1 font-mono tracking-wide">
            PS000214 · SFIC 2026–27
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-7">
          <h2 className="text-slate-800 font-semibold text-base mb-5">Sign in to your account</h2>

          {apiError && (
            <div className="flex items-start gap-2.5 p-3 rounded-md bg-red-50 border border-red-200 mb-5">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{apiError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <User size={15} className="text-slate-400" />
                </div>
                <input
                  {...register('username')}
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="Enter your username"
                  className={cn(
                    'w-full pl-9 pr-3 py-2.5 border rounded-md text-sm text-slate-900 placeholder:text-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    'transition-colors',
                    errors.username ? 'border-red-400 bg-red-50' : 'border-slate-300',
                  )}
                />
              </div>
              {errors.username && (
                <p className="text-xs text-red-600 mt-1">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock size={15} className="text-slate-400" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={cn(
                    'w-full pl-9 pr-10 py-2.5 border rounded-md text-sm text-slate-900 placeholder:text-slate-400',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    'transition-colors',
                    errors.password ? 'border-red-400 bg-red-50' : 'border-slate-300',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="w-full mt-2"
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {/* Development / Demo Mode Notice */}
          <div className="mt-5 p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <AlertCircle size={14} className="shrink-0 text-amber-600" />
              <span>Security & Demo Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800/90">
              In production, credentials authenticate with the FastAPI backend (<code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200">/auth/login</code>) using Argon2 hashes and signed JWT bearer tokens.
            </p>
            <div className="pt-1 border-t border-amber-200/60">
              <span className="text-[11px] font-medium text-amber-900 block mb-1">
                Offline UI evaluation shortcuts (Backend offline fallback):
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => { setValue('username', 'admin'); setValue('password', 'demo123'); }}
                  className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  Admin: <code className="font-mono font-bold">admin</code>
                </button>
                <button
                  type="button"
                  onClick={() => { setValue('username', 'officer'); setValue('password', 'demo123'); }}
                  className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  Officer: <code className="font-mono font-bold">officer</code>
                </button>
                <button
                  type="button"
                  onClick={() => { setValue('username', 'staff'); setValue('password', 'demo123'); }}
                  className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  Staff: <code className="font-mono font-bold">staff</code>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Authorised Panchayat personnel only. Unauthorised access is prohibited.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Contact your System Administrator if you need credentials.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}

export default LoginPage

