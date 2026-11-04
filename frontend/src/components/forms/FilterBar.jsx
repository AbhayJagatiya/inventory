import { Search, X, Filter, RotateCcw } from 'lucide-react'

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
    <div className="bg-white/80 dark:bg-forest-900/70 backdrop-blur-md rounded-2xl border border-forest-500/10 dark:border-forest-300/10 p-4 shadow-glass-sm space-y-3 mb-6 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400 dark:text-forest-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-9 py-2 text-sm bg-forest-50/50 dark:bg-forest-950/50 border border-forest-500/15 dark:border-forest-400/20 rounded-xl text-forest-950 dark:text-forest-50 placeholder:text-forest-400/80 dark:placeholder:text-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/50 focus:border-forest-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-600 dark:hover:text-forest-200"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Action Slot (e.g. Export, Add Item, View Toggle) */}
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {/* Filter Dropdowns */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-forest-500/10 dark:border-forest-400/10 text-xs">
          <div className="flex items-center gap-1.5 text-forest-600 dark:text-forest-300 font-semibold">
            <Filter size={13} />
            <span>Filters:</span>
          </div>

          {filters.map((f) => (
            <div key={f.key} className="flex items-center gap-1">
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="bg-forest-50/70 dark:bg-forest-950/70 border border-forest-500/15 dark:border-forest-400/20 rounded-xl px-3 py-1.5 text-xs text-forest-900 dark:text-forest-100 font-medium focus:outline-none focus:ring-1 focus:ring-forest-500"
              >
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-white dark:bg-forest-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="ml-auto flex items-center gap-1 text-forest-600 hover:text-forest-900 dark:text-forest-300 dark:hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-forest-500/10"
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
