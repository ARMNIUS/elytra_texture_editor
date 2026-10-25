import React from 'react'
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import XpIcon from './XpIcon'

const PRESETS = [16, 32, 64, 128, 256, 512, 1024, 2048]

type Props = {
  open: boolean
  defaultWidth?: number
  defaultHeight?: number
  onCancel: () => void
  onCreate: (width: number, height: number) => void
}

function clampSize(value: number): number {
  if (!Number.isFinite(value)) return 64
  return Math.max(1, Math.min(2048, Math.round(value)))
}

export default function NewDocumentDialog({ open, defaultWidth = 64, defaultHeight = 64, onCancel, onCreate }: Props) {
  const [width, setWidth] = useState(String(defaultWidth))
  const [height, setHeight] = useState(String(defaultHeight))
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    setWidth(String(defaultWidth))
    setHeight(String(defaultHeight))
  }, [open, defaultWidth, defaultHeight])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  const submit = () => onCreate(clampSize(Number(width)), clampSize(Number(height)))

  return createPortal(
    <div className="confirm-backdrop" onPointerDown={onCancel}>
      <div
        className="confirm-dialog new-document-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-titlebar">
          <span id={titleId}>Новый проект</span>
          <button type="button" className="confirm-close" aria-label="Отменить" onClick={onCancel}><X size={11} /></button>
        </div>
        <div className="new-document-body">
          <XpIcon name="bitmap" size={34} />
          <div className="new-document-fields">
            <label>
              <span>Ширина</span>
              <input
                aria-label="Ширина холста"
                inputMode="numeric"
                min={1}
                max={2048}
                value={width}
                onChange={(event) => setWidth(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
                autoFocus
              />
            </label>
            <label>
              <span>Высота</span>
              <input
                aria-label="Высота холста"
                inputMode="numeric"
                min={1}
                max={2048}
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
              />
            </label>
            <div className="new-document-presets" aria-label="Пресеты размера">
              {PRESETS.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={width === String(size) && height === String(size) ? 'is-active' : ''}
                  onClick={() => { setWidth(String(size)); setHeight(String(size)) }}
                >
                  {size}
                </button>
              ))}
            </div>
            <p className="new-document-hint">Прозрачный фон, до 2048×2048.</p>
          </div>
        </div>
        <div className="confirm-actions">
          <button type="button" className="confirm-primary" onClick={submit}>Создать</button>
          <button type="button" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
