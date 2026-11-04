import { useEffect } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../utils/cn'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

function Modal({ isOpen, onClose, title, children, size = 'md', footer, className }) {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-forest-950/60 dark:bg-black/75 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog Panel - Level 3 Glass */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className={cn(
              'relative z-10 w-full rounded-2xl shadow-glass-lg dark:shadow-glass-dark-lg',
              'bg-white/95 dark:bg-forest-900/95 backdrop-blur-xl border border-forest-500/20 dark:border-forest-300/20',
              'flex flex-col max-h-[90vh] overflow-hidden',
              SIZES[size],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-forest-500/10 dark:border-forest-300/10 shrink-0">
              <h2 id="modal-title" className="text-base font-bold text-forest-950 dark:text-forest-50">
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 text-forest-500 hover:text-forest-900 dark:text-forest-400 dark:hover:text-forest-100 hover:bg-forest-500/10 rounded-xl transition-colors"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin text-forest-900 dark:text-forest-100">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-forest-500/10 dark:border-forest-300/10 bg-forest-50/50 dark:bg-forest-950/40 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default Modal
