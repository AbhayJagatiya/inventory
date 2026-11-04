import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import { ROUTES } from '../../constants/routes'

function UnauthorizedPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <GlassCard level={1} className="p-8 max-w-md w-full flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-600 dark:text-rose-400">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-xl font-bold text-forest-950 dark:text-forest-50 mb-2">Access Restricted (403)</h1>
        <p className="text-xs sm:text-sm text-forest-600 dark:text-forest-300 mb-6 leading-relaxed">
          You do not possess the required RBAC authority or office jurisdiction to access this resource.
        </p>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
            Back to Dashboard
          </Button>
        </Link>
      </GlassCard>
    </div>
  )
}

export default UnauthorizedPage
