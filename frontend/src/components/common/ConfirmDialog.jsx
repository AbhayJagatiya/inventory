import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 items-start">
        <div className="shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400" />
          </div>
        </div>
        <p className="text-sm text-forest-800 dark:text-forest-200 leading-relaxed">{message}</p>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
