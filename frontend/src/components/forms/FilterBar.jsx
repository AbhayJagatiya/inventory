import { Search, X, Filter, RotateCcw } from 'lucide-react'
import Button from '../common/Button'

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search by code, name, serial or barcode…',
  filters = [],
  onClearFilters,
  actions,
}) {
  const hasActiveFilters = searchQuery || filters.some((f) => f.value && f.value !== 'ALL' && f.value !== '')

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-3 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Slot (e.g. Export, Add Item) */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Filter Dropdowns */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Filter size={13} />
            <span>Filters:</span>
          </div>

          {filters.map((f) => (
            <div key={f.key} className="flex items-center gap-1">
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="ml-auto flex items-center gap-1 text-slate-500 hover:text-blue-700 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default FilterBar

