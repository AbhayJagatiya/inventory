import { Link } from 'react-router-dom'
import { ArrowLeft, Info, ShieldCheck } from 'lucide-react'
import AuthLayout from '../../components/layout/AuthLayout'
import Button from '../../components/common/Button'
import { ROUTES } from '../../constants/routes'

function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Password Recovery Policy</h1>
          <p className="text-xs text-slate-500 mt-1">
            District Development Office – Gir Somnath
          </p>
        </div>

        <div className="p-4 rounded-lg bg-blue-50/70 border border-blue-200 text-slate-700 text-sm space-y-3 mb-6">
          <div className="flex items-start gap-2.5">
            <Info size={18} className="text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold text-blue-900">Admin-Assisted Password Reset</p>
              <p className="text-xs leading-relaxed text-slate-600">
                In compliance with Panchayat Office security policy and government audit standards, automated self-service password resets are disabled.
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                Please contact your designated <strong>System Administrator</strong> at the District Panchayat Store Department to request a one-time temporary password.
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

