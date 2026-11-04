import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, User, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { extractApiError } from '../../api/client'
import AuthLayout from '../../components/layout/AuthLayout'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import { cn } from '../../utils/cn'
import { motion } from 'framer-motion'

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
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <GlassCard level={3} cursorLight={true} className="p-0 overflow-hidden shadow-2xl border-white/20 dark:border-forest-500/30">
          {/* Header */}
          <div className="bg-gradient-to-b from-[#075443] to-[#087B61] dark:from-[#091210] dark:to-[#163C32] px-8 py-7 text-center relative border-b border-white/10">
            {/* Emblem insignia badge */}
            <div className="w-16 h-16 rounded-2xl bg-white/15 border-2 border-white/30 flex items-center justify-center mx-auto mb-3.5 shadow-lg backdrop-blur-md">
              <span className="text-2xl font-extrabold text-white tracking-wider">GS</span>
            </div>
            <h1 className="text-white font-bold text-base sm:text-lg leading-tight">
              Dead Stock Inventory Management
            </h1>
            <p className="text-forest-100/90 text-xs mt-1">
              District Development Office · Gir Somnath
            </p>
            <p className="text-forest-200/80 text-[11px] mt-1 font-mono tracking-wider">
              PS000214 · SFIC 2026–27
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-7 bg-white/90 dark:bg-forest-900/90 backdrop-blur-xl">
            <h2 className="text-forest-950 dark:text-forest-50 font-bold text-base mb-5">
              Sign in to your account
            </h2>

            {apiError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-5">
                <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{apiError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-forest-800 dark:text-forest-200 mb-1.5">
                  Official Username / Role ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <User size={15} className="text-forest-400" />
                  </div>
                  <input
                    {...register('username')}
                    type="text"
                    autoComplete="username"
                    autoFocus
                    placeholder="e.g. admin, officer, or staff"
                    className={cn(
                      'w-full pl-9 pr-3 py-2.5 bg-forest-50/50 dark:bg-forest-950/50 border rounded-xl text-sm text-forest-950 dark:text-forest-50 placeholder:text-forest-400/80',
                      'focus:outline-none focus:ring-2 focus:ring-forest-500/50 focus:border-forest-500',
                      'transition-all',
                      errors.username
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                        : 'border-forest-500/20 dark:border-forest-300/20'
                    )}
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.username.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-forest-800 dark:text-forest-200 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Lock size={15} className="text-forest-400" />
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={cn(
                      'w-full pl-9 pr-10 py-2.5 bg-forest-50/50 dark:bg-forest-950/50 border rounded-xl text-sm text-forest-950 dark:text-forest-50 placeholder:text-forest-400/80',
                      'focus:outline-none focus:ring-2 focus:ring-forest-500/50 focus:border-forest-500',
                      'transition-all',
                      errors.password
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                        : 'border-forest-500/20 dark:border-forest-300/20'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-3 flex items-center text-forest-400 hover:text-forest-600 dark:hover:text-forest-200"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{errors.password.message}</p>
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



            <div className="mt-4 pt-3 border-t border-forest-500/10 dark:border-forest-300/10 text-center text-[11px] text-forest-500 dark:text-forest-400">
              Authorized Panchayat Personnel Only · Veraval, Gujarat
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </AuthLayout>
  )
}

export default LoginPage
