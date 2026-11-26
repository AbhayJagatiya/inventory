import { Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n'

function PageLoader({ message }) {
  const { t } = useLanguage()
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#08100E] z-50">
      <Loader2 size={36} className="text-emerald-600 animate-spin mb-3" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message || t('labels.loading')}</p>
    </div>
  )
}

export default PageLoader
