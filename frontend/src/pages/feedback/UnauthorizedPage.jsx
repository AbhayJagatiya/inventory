import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import { ROUTES } from '../../constants/routes'

function UnauthorizedPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <ShieldAlert size={32} className="text-red-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Access Denied (403)</h1>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        You do not have the required permissions or assigned office authority to view this page or execute this action.
      </p>
      <div className="flex items-center gap-3">
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default UnauthorizedPage

