import { AlertCircle, RefreshCw } from 'lucide-react'
import Button from '../common/Button'

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle size={28} className="text-red-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Failed to load data</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">
        {message || 'An error occurred while fetching data. Please try again.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export default ErrorState

