import { Link } from 'react-router-dom'
import { ArrowLeft, Info, ShieldCheck } from 'lucide-react'
import AuthLayout from '../../components/layout/AuthLayout'
import Button from '../../components/common/Button'
import { ROUTES } from '../../constants/routes'

function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/20 shadow-2xl overflow-hidden p-8 transition-colors">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">Password Recovery Policy</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            District Development Office – Gir Somnath
          </p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-slate-700 dark:text-slate-300 text-sm space-y-3 mb-6">
          <div className="flex items-start gap-2.5">
            <Info size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold text-emerald-950 dark:text-emerald-200">Admin-Assisted Password Reset</p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                In compliance with Panchayat Office security policy and government audit standards, automated self-service password resets are disabled.
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Please contact your designated <strong className="text-slate-900 dark:text-white">System Administrator</strong> at the District Panchayat Store Department to request a one-time temporary password.
              </p>
            </div>
          </div>
        </div>

        <Link to={ROUTES.LOGIN} className="w-full block">
          <Button variant="secondary" className="w-full" leftIcon={<ArrowLeft size={16} />}>
            Return to Login
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}

export default ForgotPasswordPage

