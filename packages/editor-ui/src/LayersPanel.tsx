import React from 'react'
import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Merge, Plus, Trash2 } from './icons'
import { useContextMenu } from './ContextMenu'
import type { Layer } from '@rawsprite/core/layers'

type Props = {
  /** Bottom-to-top order, exactly as stored in the document. */
  layers: Layer[]
  activeLayerId: string
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onAdd: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: 1 | -1) => void
  onMergeDown: (id: string) => void
  onRename: (id: string, name: string) => void
  onOpacityStart: () => void
  onOpacityChange: (id: string, value: number) => void
  onOpacityEnd: () => void
}

export default function LayersPanel({
  layers, activeLayerId, onSelect, onToggleVisibility, onAdd, onDuplicate, onDelete,
  onMove, onMergeDown, onRename, onOpacityStart, onOpacityChange, onOpacityEnd,
}: Props) {
  const { openContextMenu } = useContextMenu()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  // The panel lists layers top-first, while the document stores them bottom-to-top.
  const topFirst = [...layers].reverse()
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[layers.length - 1]
  const activeIndex = layers.findIndex((layer) => layer.id === activeLayerId)

  const startRename = (layer: Layer) => {
    setRenamingId(layer.id)
    setRenameDraft(layer.name)
  }

  const commitRename = () => {
    if (!renamingId) return
    const name = renameDraft.trim()
    if (name) onRename(renamingId, name.slice(0, 40))
    setRenamingId(null)
  }

  const handleRenameKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commitRename()
    if (event.key === 'Escape') setRenamingId(null)
  }

  const openLayerMenu = (event: ReactMouseEvent<HTMLDivElement>, layer: Layer) => {
    openContextMenu(event, [
      { label: 'Переименовать', action: () => startRename(layer) },
      { label: 'Дублировать слой', icon: <Copy size={13} />, action: () => onDuplicate(layer.id) },
      { label: 'Объединить с нижним', icon: <Merge size={13} />, disabled: layers.indexOf(layer) === 0, action: () => onMergeDown(layer.id) },
      { separator: true },
      { label: 'Поднять слой', icon: <ChevronUp size={13} />, disabled: layers.indexOf(layer) === layers.length - 1, action: () => onMove(layer.id, 1) },
      { label: 'Опустить слой', icon: <ChevronDown size={13} />, disabled: layers.indexOf(layer) === 0, action: () => onMove(layer.id, -1) },
      { separator: true },
      { label: 'Скрыть / показать', checked: layer.visible, action: () => onToggleVisibility(layer.id) },
      { label: 'Удалить слой', danger: true, icon: <Trash2 size={13} />, disabled: layers.length < 2, action: () => onDelete(layer.id) },
    ])
  }

  return (
    <section className="side-section layers-section">
      <div className="section-heading"><span>СЛОИ</span><span className="mini-count">{layers.length}</span></div>

      <div className="layer-list" role="listbox" aria-label="Слои документа" aria-activedescendant={`layer-${activeLayerId}`}>
        {topFirst.map((layer) => {
          const isActive = layer.id === activeLayerId
          return (
            <div
              key={layer.id}
              id={`layer-${layer.id}`}
              role="option"
              aria-selected={isActive}
              tabIndex={0}
              className={`layer-row ${isActive ? 'layer-row-active' : ''} ${layer.visible ? '' : 'layer-row-hidden'}`}
              onClick={() => onSelect(layer.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(layer.id) }
              }}
              onContextMenu={(event) => { event.stopPropagation(); openLayerMenu(event, layer) }}
            >
              <button
                type="button"
                className="layer-eye"
                onClick={(event) => { event.stopPropagation(); onToggleVisibility(layer.id) }}
                title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
                aria-label={layer.visible ? 'Скрыть слой' : 'Показать слой'}
              >{layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
              {renamingId === layer.id
                ? <input
                    className="layer-rename-input"
                    value={renameDraft}
                    autoFocus
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKey}
                    aria-label="Имя слоя"
                  />
                : <span className="layer-name" onDoubleClick={() => startRename(layer)} title={`${layer.name} — двойной клик для переименования`}>{layer.name}</span>}
              {layer.opacity < 100 && <span className="layer-opacity-badge">{layer.opacity}%</span>}
            </div>
          )
        })}
      </div>

      <div className="layer-actions">
        <button type="button" className="icon-button small-icon-button" onClick={onAdd} title="Новый слой"><Plus size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={() => onDuplicate(activeLayerId)} title="Дублировать активный слой"><Copy size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={() => onMergeDown(activeLayerId)} disabled={activeIndex <= 0} title="Объединить с нижним слоем"><Merge size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={() => onMove(activeLayerId, 1)} disabled={activeIndex >= layers.length - 1} title="Поднять слой"><ChevronUp size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={() => onMove(activeLayerId, -1)} disabled={activeIndex <= 0} title="Опустить слой"><ChevronDown size={13} /></button>
        <button type="button" className="icon-button small-icon-button danger-icon" onClick={() => onDelete(activeLayerId)} disabled={layers.length < 2} title="Удалить активный слой"><Trash2 size={13} /></button>
      </div>

      <label className="layer-opacity-row">
        <span>Прозрачность</span>
        <input
          type="range"
          min="0"
          max="100"
          value={activeLayer?.opacity ?? 100}
          onPointerDown={onOpacityStart}
          onPointerUp={onOpacityEnd}
          onPointerCancel={onOpacityEnd}
          onBlur={onOpacityEnd}
          onKeyDown={onOpacityStart}
          onKeyUp={onOpacityEnd}
          onChange={(event) => { if (activeLayer) onOpacityChange(activeLayer.id, Number(event.target.value)) }}
          aria-label="Прозрачность активного слоя"
        />
        <span className="layer-opacity-value">{activeLayer?.opacity ?? 100}%</span>
      </label>
    </section>
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
