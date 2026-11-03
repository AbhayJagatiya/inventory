import { Link } from 'react-router-dom'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import { ROUTES } from '../../constants/routes'

function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <FileQuestion size={32} className="text-slate-500" />
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Page Not Found (404)</h1>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        The requested page, asset record, or register could not be found. Please check the URL or return to dashboard.
      </p>
      <Link to={ROUTES.DASHBOARD}>
        <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
          Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}

export default NotFoundPage

