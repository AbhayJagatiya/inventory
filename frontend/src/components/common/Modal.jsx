import { Fragment } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

function Modal({ isOpen, onClose, title, children, size = 'md', footer, className }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'relative z-10 w-full bg-white rounded-lg shadow-xl',
          'flex flex-col max-h-[90vh]',
          SIZES[size],
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 id="modal-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal

