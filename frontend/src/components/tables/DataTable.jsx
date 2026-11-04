import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { TableSkeleton } from '../feedback/LoadingSkeleton'
import EmptyState from '../feedback/EmptyState'

export function DataTable({
  columns,
  data = [],
  isLoading = false,
  page = 1,
  limit = 20,
  total = 0,
  totalPages = 1,
  onPageChange,
  onLimitChange,
  sortBy,
  sortOrder = 'asc',
  onSort,
  onRowClick,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no records matching your query or active filters.',
  className,
}) {
  const handleSort = (key) => {
    if (!onSort) return
    if (sortBy === key) {
      onSort(key, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(key, 'asc')
    }
  }

  return (
    <div className={cn(
      'bg-white dark:bg-[#0E1D19] rounded-2xl border border-slate-200 dark:border-emerald-500/15 shadow-xs overflow-hidden flex flex-col transition-colors',
      className
    )}>
      <div className="overflow-x-auto scrollbar-thin flex-1">
        <table className="w-full text-left border-collapse data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key || col.header}
                  style={{ width: col.width }}
                  className={cn(
                    col.sortable && 'cursor-pointer select-none hover:bg-forest-500/10 transition-colors',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className={cn(
                    'flex items-center gap-1.5',
                    col.align === 'right' && 'justify-end',
                    col.align === 'center' && 'justify-center',
                  )}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-forest-400">
                        {sortBy === col.key ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp size={13} className="text-forest-600 dark:text-forest-300" />
                          ) : (
                            <ArrowDown size={13} className="text-forest-600 dark:text-forest-300" />
                          )
                        ) : (
                          <ArrowUpDown size={13} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-500/5 dark:divide-forest-300/5">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <TableSkeleton rows={limit > 10 ? 10 : limit} cols={columns.length} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    'transition-colors duration-150',
                    onRowClick && 'cursor-pointer hover:bg-forest-500/8 dark:hover:bg-forest-400/8'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key || col.header}
                      className={cn(
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.cellClassName
                      )}
                    >
                      {col.render ? col.render(row[col.key], row, rowIdx) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {total > 0 && onPageChange && (
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-emerald-500/15 bg-slate-50/70 dark:bg-[#0A1513] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
              className="bg-white dark:bg-[#12221E] border border-slate-300 dark:border-emerald-500/20 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              {[10, 20, 50, 100].map((pageSize) => (
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

export default DataTable
