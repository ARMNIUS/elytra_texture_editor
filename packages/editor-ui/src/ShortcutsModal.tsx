import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { shortcutKey } from '@rawsprite/core/shortcutKey'

export type ShortcutId =
  | 'select' | 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'ellipse'
  | 'undo' | 'redo' | 'copy' | 'copyMerged' | 'cut' | 'paste' | 'pasteNewLayer' | 'deleteSelection' | 'selectAll' | 'deselect'
  | 'open' | 'openProject' | 'saveProject' | 'saveProjectAs' | 'export' | 'newProject' | 'closeProject'
  | 'toggleUv' | 'toggleGrid' | 'toggleView'
export type ShortcutMap = Record<ShortcutId, string>

export const defaultShortcuts: ShortcutMap = {
  select: 'M',
  brush: 'B',
  eraser: 'E',
  fill: 'G',
  eyedropper: 'I',
  line: 'L',
  rect: 'U',
  ellipse: 'O',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  copy: 'Ctrl+C',
  copyMerged: 'Ctrl+Shift+C',
  cut: 'Ctrl+X',
  paste: 'Ctrl+V',
  pasteNewLayer: 'Ctrl+Shift+V',
  deleteSelection: 'Delete',
  selectAll: 'Ctrl+A',
  deselect: 'Ctrl+D',
  open: 'Ctrl+O',
  openProject: 'Ctrl+Shift+O',
  saveProject: 'Ctrl+S',
  saveProjectAs: 'Ctrl+Shift+S',
  export: 'Ctrl+Shift+E',
  newProject: 'Ctrl+N',
  closeProject: 'Ctrl+W',
  toggleUv: 'Ctrl+U',
  toggleGrid: 'H',
  toggleView: 'V',
}

export function normalizeShortcuts(input: Partial<ShortcutMap>): ShortcutMap {
  const merged: ShortcutMap = { ...defaultShortcuts }
  for (const id of Object.keys(defaultShortcuts) as ShortcutId[]) {
    const value = input[id]
    if (typeof value === 'string' && value.length > 0) merged[id] = value
  }
  // Older builds bound both the rectangle tool and the UV overlay to "U".
  // Rectangle wins; move the overlay to Ctrl+U instead of silently shadowing it.
  if (merged.toggleUv === merged.rect) merged.toggleUv = 'Ctrl+U'
  return merged
}

const shortcutLabels: Array<{ id: ShortcutId; label: string; group: string }> = [
  { id: 'select', label: 'Выделение (рамка)', group: 'ИНСТРУМЕНТЫ' },
  { id: 'brush', label: 'Карандаш', group: 'ИНСТРУМЕНТЫ' },
  { id: 'eraser', label: 'Ластик', group: 'ИНСТРУМЕНТЫ' },
  { id: 'fill', label: 'Заливка', group: 'ИНСТРУМЕНТЫ' },
  { id: 'eyedropper', label: 'Пипетка', group: 'ИНСТРУМЕНТЫ' },
  { id: 'line', label: 'Линия', group: 'ИНСТРУМЕНТЫ' },
  { id: 'rect', label: 'Прямоугольник', group: 'ИНСТРУМЕНТЫ' },
  { id: 'ellipse', label: 'Эллипс', group: 'ИНСТРУМЕНТЫ' },
  { id: 'undo', label: 'Отменить действие', group: 'РЕДАКТИРОВАНИЕ' },
  { id: 'redo', label: 'Повторить действие', group: 'РЕДАКТИРОВАНИЕ' },
  { id: 'copy', label: 'Копировать выделение', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'copyMerged', label: 'Копировать объединённое', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'cut', label: 'Вырезать выделение', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'paste', label: 'Вставить', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'pasteNewLayer', label: 'Вставить в новый слой', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'deleteSelection', label: 'Очистить выделение', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'selectAll', label: 'Выделить весь холст', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'deselect', label: 'Снять выделение', group: 'ВЫДЕЛЕНИЕ' },
  { id: 'open', label: 'Открыть PNG / текстуру', group: 'ФАЙЛ' },
  { id: 'newProject', label: 'Новый проект', group: 'ФАЙЛ' },
  { id: 'openProject', label: 'Открыть проект .mts', group: 'ФАЙЛ' },
  { id: 'saveProject', label: 'Сохранить проект .mts', group: 'ФАЙЛ' },
  { id: 'saveProjectAs', label: 'Сохранить проект как…', group: 'ФАЙЛ' },
  { id: 'closeProject', label: 'Закрыть проект', group: 'ФАЙЛ' },
  { id: 'export', label: 'Экспорт PNG', group: 'ФАЙЛ' },
  { id: 'toggleUv', label: 'Показать / скрыть UV', group: 'ВИД' },
  { id: 'toggleGrid', label: 'Показать / скрыть сетку', group: 'ВИД' },
  { id: 'toggleView', label: 'Переключить 2D / Split', group: 'ВИД' },
]

const shortcutLabelById = new Map(shortcutLabels.map((item) => [item.id, item.label]))

// Palette cycling and pose preview own these keys directly.
const RESERVED_SHORTCUTS = ['[', ']', 'A', 'Shift']

type Props = {
  shortcuts: ShortcutMap
  onChange: (id: ShortcutId, value: string) => void
  onClose: () => void
  onReset: () => void
}

function normalizeEventKey(event: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(event.key)) return null
  const key = shortcutKey(event)
  const modifiers: string[] = []
  if (event.ctrlKey || event.metaKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  return [...modifiers, key].join('+')
}

export default function ShortcutsModal({ shortcuts, onChange, onClose, onReset }: Props) {
  const [listeningFor, setListeningFor] = useState<ShortcutId | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const stopListening = () => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setListeningFor(null)
  }

  // Never leave a capture listener behind when the dialog closes or a new row is picked.
  useEffect(() => () => cleanupRef.current?.(), [])

  const startListening = (id: ShortcutId) => {
    cleanupRef.current?.()
    setConflict(null)
    setListeningFor(id)
    const listener = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        stopListening()
        return
      }
      const shortcut = normalizeEventKey(event)
      if (!shortcut) return
      if (RESERVED_SHORTCUTS.includes(shortcut)) {
        setConflict(`Комбинация ${shortcut} зарезервирована редактором`)
        return
      }
      const owner = (Object.keys(shortcuts) as ShortcutId[]).find((otherId) => otherId !== id && shortcuts[otherId] === shortcut)
      if (owner) {
        setConflict(`Комбинация ${shortcut} уже занята: «${shortcutLabelById.get(owner) ?? owner}»`)
        return
      }
      onChange(id, shortcut)
      setConflict(null)
      stopListening()
    }
    window.addEventListener('keydown', listener, true)
    cleanupRef.current = () => window.removeEventListener('keydown', listener, true)
  }

  const close = () => {
    stopListening()
    onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <section className="shortcuts-modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <header className="modal-header">
          <div className="modal-title"><Keyboard size={19} /><div><h2 id="shortcuts-title">Горячие клавиши</h2><p>Назначай удобные бинды под себя.</p></div></div>
          <button className="icon-button" type="button" onClick={close} aria-label="Закрыть"><X size={18} /></button>
        </header>
        <div className="shortcut-list">
          {shortcutLabels.map((item, index) => (
            <div key={item.id}>
              {(index === 0 || shortcutLabels[index - 1].group !== item.group) && <div className="shortcut-group-label">{item.group}</div>}
              <div className="shortcut-row"><span>{item.label}</span><button type="button" className={`keybind-button ${listeningFor === item.id ? 'keybind-listening' : ''}`} onClick={() => startListening(item.id)}>{listeningFor === item.id ? 'Нажми клавишу…' : shortcuts[item.id]}</button></div>
            </div>
          ))}
        </div>
        <footer className="modal-footer">
          <span className={conflict ? 'shortcut-conflict' : undefined} role="status">{conflict ?? 'Esc — отменить назначение'}</span>
          <button className="subtle-button" type="button" onClick={onReset}>Сбросить на стандартные</button>
        </footer>
      </section>
    </div>
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
