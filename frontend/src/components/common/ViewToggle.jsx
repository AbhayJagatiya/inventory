import { LayoutGrid, Table } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useLanguage } from '../../i18n'

export function ViewToggle({ view = 'table', onViewChange, className }) {
  const { t } = useLanguage()
  return (
    <div
      className={cn(
        'inline-flex items-center p-1 bg-forest-500/10 dark:bg-forest-950/50 rounded-xl border border-forest-500/15 dark:border-forest-300/15',
        className
      )}
      role="group"
      aria-label={t('ui.viewToggle.tableView')}
    >
      <button
        type="button"
        onClick={() => onViewChange('table')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
          view === 'table'
            ? 'bg-white dark:bg-forest-800 text-forest-900 dark:text-forest-100 shadow-xs'
            : 'text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100'
        )}
        title={t('ui.viewToggle.tableView')}
      >
        <Table size={14} />
        <span className="hidden sm:inline">{t('ui.viewToggle.tableView')}</span>
      </button>

      <button
        type="button"
        onClick={() => onViewChange('card')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
          view === 'card'
            ? 'bg-white dark:bg-forest-800 text-forest-900 dark:text-forest-100 shadow-xs'
            : 'text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100'
        )}
        title={t('ui.viewToggle.cardView')}
      >
        <LayoutGrid size={14} />
        <span className="hidden sm:inline">{t('ui.viewToggle.cardView')}</span>
      </button>
    </div>
  )
}

export default ViewToggle
