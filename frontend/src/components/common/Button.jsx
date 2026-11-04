import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const VARIANTS = {
  primary:
    'bg-forest-500 text-white hover:bg-forest-600 active:bg-forest-700 dark:bg-forest-400 dark:text-forest-950 dark:hover:bg-forest-300 shadow-sm focus:ring-forest-500 disabled:opacity-50',
  secondary:
    'bg-white/90 dark:bg-forest-800/90 text-forest-900 dark:text-forest-100 border border-forest-500/20 dark:border-forest-300/20 hover:bg-forest-50 dark:hover:bg-forest-700/60 focus:ring-forest-500 disabled:opacity-50 shadow-sm',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 disabled:opacity-50 shadow-sm',
  ghost:
    'text-forest-700 dark:text-forest-200 hover:bg-forest-500/10 focus:ring-forest-400 disabled:opacity-50',
  link:
    'text-forest-600 dark:text-forest-400 hover:underline p-0 focus:ring-0 disabled:opacity-50',
}

const SIZES = {
  xs: 'px-2.5 py-1 text-xs rounded-lg',
  sm: 'px-3 py-1.5 text-xs rounded-xl font-medium',
  md: 'px-4 py-2 text-sm rounded-xl font-medium',
  lg: 'px-5 py-2.5 text-base rounded-2xl font-semibold',
}

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    className,
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-forest-900',
        'disabled:cursor-not-allowed select-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  )
})

export default Button
