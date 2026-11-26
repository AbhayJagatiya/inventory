import { AlertCircle, RefreshCw } from 'lucide-react'
import Button from '../common/Button'
import { useLanguage } from '../../i18n'

function ErrorState({ message, onRetry }) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center mb-4 shadow-sm">
        <AlertCircle size={30} className="text-rose-600 dark:text-rose-400" />
      </div>
      <h3 className="text-sm font-bold text-forest-950 dark:text-forest-50 mb-1">
        {t('feedback.error.title')}
      </h3>
      <p className="text-xs sm:text-sm text-forest-700/80 dark:text-forest-300/80 max-w-sm mb-4 leading-relaxed">
        {message || t('feedback.error.message')}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={onRetry}>
          {t('feedback.error.retry')}
        </Button>
      )}
    </div>
  )
}

export default ErrorState
