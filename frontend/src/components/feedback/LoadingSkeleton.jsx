import { cn } from '../../utils/cn'

// Generic skeleton shimmer
function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-forest-500/10 dark:bg-forest-300/10',
        className
      )}
    />
  )
}

// Table rows skeleton
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="space-y-0 divide-y divide-forest-500/5 dark:divide-forest-300/5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn('h-4', j === 0 ? 'w-32' : j === cols - 1 ? 'w-16' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Card skeleton (KPI)
export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-forest-500/10 dark:border-forest-300/10 bg-white/70 dark:bg-forest-850/60 p-5 space-y-3 shadow-glass-sm backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  )
}

// Page content skeleton
export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-forest-500/10 dark:border-forest-300/10 bg-white/70 dark:bg-forest-850/60 overflow-hidden shadow-glass-sm">
        <div className="px-4 py-3 border-b border-forest-500/10 dark:border-forest-300/10 flex gap-4">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <TableSkeleton />
      </div>
    </div>
  )
}

export default Skeleton
