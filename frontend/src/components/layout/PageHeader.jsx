import { cn } from '../../utils/cn'
import Breadcrumbs from './Breadcrumbs'

function PageHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cn('mb-6', className)}>
      <Breadcrumbs />
      <div className="flex flex-wrap items-start justify-between gap-4 mt-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default PageHeader

