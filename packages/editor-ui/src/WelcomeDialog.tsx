import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, appIconCreate, appIconImport, appIconOpen } from './icons'

type Props = {
  open: boolean
  appName: string
  icon: string
  onCreate: () => void
  onOpen: () => void
  onImportPng: () => void
  onClose: () => void
}

export default function WelcomeDialog({ open, appName, icon, onCreate, onOpen, onImportPng, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="confirm-backdrop welcome-backdrop" onPointerDown={onClose}>
      <div className="confirm-dialog welcome-dialog" role="dialog" aria-modal="true" aria-label={`Добро пожаловать в ${appName}`} onPointerDown={(event) => event.stopPropagation()}>
        <div className="confirm-titlebar">
          <span>Добро пожаловать</span>
          <button type="button" className="confirm-close" aria-label="Закрыть приветствие" onClick={onClose}><X size={11} /></button>
        </div>
        <div className="welcome-brand">
          <img src={icon} width={54} height={54} alt="" className="welcome-app-icon" />
          <div>
            <h1>{appName}</h1>
            <p>Пиксель-арт редактор</p>
          </div>
        </div>
        <div className="welcome-actions">
          <button type="button" className="welcome-action" onClick={onCreate}>
            <img src={appIconCreate} width={34} height={34} alt="" />
            <span><strong>Создать проект</strong><small>Новый холст</small></span>
          </button>
          <button type="button" className="welcome-action" onClick={onOpen}>
            <img src={appIconOpen} width={34} height={34} alt="" />
            <span><strong>Открыть проект</strong><small>Продолжить работу</small></span>
          </button>
          <button type="button" className="welcome-action" onClick={onImportPng}>
            <img src={appIconImport} width={34} height={34} alt="" />
            <span><strong>Импортировать PNG</strong><small>Начать с изображения</small></span>
          </button>
        </div>
        <div className="welcome-footer">
          <button type="button" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

void React
