import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import XpIcon from './XpIcon'

type Props = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title = 'Подтверждение', message, confirmLabel = 'ОК', cancelLabel = 'Отмена',
  danger = false, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  return createPortal(
    <div className="confirm-backdrop" onPointerDown={onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-titlebar">
          <span id="confirm-dialog-title">{title}</span>
          <button type="button" className="confirm-close" aria-label="Отменить" onClick={onCancel}><X size={11} /></button>
        </div>
        <div className="confirm-body">
          <XpIcon name="alert" size={34} />
          <p id="confirm-dialog-message">{message}</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className={danger ? 'confirm-primary confirm-danger' : 'confirm-primary'} onClick={onConfirm} autoFocus>{confirmLabel}</button>
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
