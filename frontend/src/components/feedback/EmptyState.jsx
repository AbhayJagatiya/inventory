import { InboxIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

function EmptyState({
  icon: Icon = InboxIcon,
  title = 'No records found',
  description,
  action,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center select-none', className)}>
      <div className="w-16 h-16 rounded-2xl bg-forest-500/10 dark:bg-forest-400/10 border border-forest-500/15 flex items-center justify-center mb-4 text-forest-600 dark:text-forest-300 shadow-sm">
        <Icon size={30} />
      </div>
      <h3 className="text-sm font-bold text-forest-900 dark:text-forest-100 mb-1">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-forest-600 dark:text-forest-300 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

export default EmptyState
