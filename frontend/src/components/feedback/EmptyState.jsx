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
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}

export default EmptyState

