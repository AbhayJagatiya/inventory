import { Link } from 'react-router-dom'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import GlassCard from '../../components/common/GlassCard'
import { ROUTES } from '../../constants/routes'

function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <GlassCard level={1} className="p-8 max-w-md w-full flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-forest-500/10 dark:bg-forest-400/10 border border-forest-500/20 flex items-center justify-center mb-4 text-forest-600 dark:text-forest-300">
          <FileQuestion size={32} />
        </div>
        <h1 className="text-xl font-bold text-forest-950 dark:text-forest-50 mb-2">Page Not Found (404)</h1>
        <p className="text-xs sm:text-sm text-forest-600 dark:text-forest-300 mb-6 leading-relaxed">
          The requested page, asset record, or register could not be located in the system.
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

export default NotFoundPage
