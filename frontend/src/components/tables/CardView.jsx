import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import { cn } from '../../utils/cn'
import GlassCard from '../common/GlassCard'
import EmptyState from '../feedback/EmptyState'

export function CardView({
  data = [],
  renderCard,
  isLoading = false,
  page = 1,
  limit = 20,
  total = 0,
  totalPages = 1,
  onPageChange,
  onLimitChange,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no records matching your query or active filters.',
  className,
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassCard key={i} level={1} className="p-5 space-y-3 animate-pulse">
            <div className="flex justify-between items-start">
              <div className="h-4 bg-forest-500/10 dark:bg-forest-300/10 rounded w-28" />
              <div className="h-5 bg-forest-500/10 dark:bg-forest-300/10 rounded-full w-16" />
            </div>
            <div className="h-6 bg-forest-500/10 dark:bg-forest-300/10 rounded w-3/4" />
            <div className="space-y-1.5 pt-2">
              <div className="h-3 bg-forest-500/10 dark:bg-forest-300/10 rounded w-1/2" />
              <div className="h-3 bg-forest-500/10 dark:bg-forest-300/10 rounded w-2/3" />
            </div>
          </GlassCard>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <GlassCard level={1} className="p-8">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </GlassCard>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Grid of Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((item, index) => renderCard(item, index))}
      </div>

      {/* Pagination Footer */}
      {total > 0 && onPageChange && (
        <div className="px-5 py-3.5 bg-white/80 dark:bg-forest-900/80 backdrop-blur-md rounded-2xl border border-forest-500/15 dark:border-forest-300/15 shadow-glass-sm flex flex-wrap items-center justify-between gap-3 text-xs text-forest-700 dark:text-forest-300">
          <div className="flex items-center gap-2">
            <span>Cards per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
              className="bg-white dark:bg-forest-800 border border-forest-500/20 dark:border-forest-400/20 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-forest-500 font-medium"
            >
              {[12, 24, 48].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
            <span className="text-forest-300 dark:text-forest-700">|</span>
            <span>
              Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total} records
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-forest-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="First Page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-forest-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2.5 font-semibold text-forest-900 dark:text-forest-100">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-forest-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-forest-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Last Page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CardView

