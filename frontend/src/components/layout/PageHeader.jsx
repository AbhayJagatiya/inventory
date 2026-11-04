import { cn } from '../../utils/cn'

function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn('mb-6 sm:mb-8', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-forest-950 dark:text-forest-50 tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-forest-700/80 dark:text-forest-300/80 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default PageHeader
