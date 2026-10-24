import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, Download, Pencil, Plus, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react'
import { useContextMenu } from './ContextMenu'
import ColorEditorWindow from './ColorEditorWindow'
import ConfirmDialog from './ConfirmDialog'
import { palettes } from '../data/palettes'
import type { Palette } from '../data/palettes'
import { hexToRgb, hsvToRgb, normalizeColor, normalizeRgbaColor, opaqueColor, parseRgba, rgbToHex, rgbToHsv, withAlpha } from '../utils/color'

type Props = {
  currentColor: string
  secondaryColor: string
  activeColorSlot: 'foreground' | 'background'
  onSelectColor: (color: string) => void
  onSelectSlot: (slot: 'foreground' | 'background') => void
  onNotice?: (message: string) => void
}

const SAVED_COLORS_NAME = 'Мои цвета'

function readStoredStringArray(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').map(normalizeColor).filter((item): item is string => item !== null) : []
  } catch { return [] }
}

function readStoredPalettes(): Palette[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('mts-user-palettes-v1') ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((candidate): Palette[] => {
      if (typeof candidate !== 'object' || candidate === null || !('name' in candidate) || !('colors' in candidate)) return []
      const value = candidate as { name?: unknown; colors?: unknown }
      if (typeof value.name !== 'string' || !Array.isArray(value.colors)) return []
      const colors = [...new Set(value.colors.filter((item): item is string => typeof item === 'string').map(normalizeColor).filter((item): item is string => item !== null))]
      return [{ name: value.name.slice(0, 80), colors }]
    })
  } catch { return [] }
}

function uniqueColors(colors: string[]): string[] {
  return [...new Set(colors.map(normalizeColor).filter((color): color is string => color !== null))]
}

async function parsePaletteFile(file: File): Promise<Palette> {
  const text = await file.text()
  const extension = file.name.split('.').pop()?.toLowerCase()
  let name = file.name.replace(/\.[^.]+$/, '') || 'Imported palette'
  let colors: string[] = []

  if (extension === 'json') {
    const data: unknown = JSON.parse(text)
    if (Array.isArray(data)) colors = data.filter((value): value is string => typeof value === 'string')
    else if (typeof data === 'object' && data !== null) {
      const object = data as { name?: unknown; colors?: unknown; palette?: { name?: unknown; colors?: unknown } }
      if (typeof object.name === 'string') name = object.name
      const importedColors = Array.isArray(object.colors) ? object.colors : object.palette?.colors
      colors = Array.isArray(importedColors) ? importedColors.filter((value): value is string => typeof value === 'string') : []
      if (typeof object.palette?.name === 'string' && typeof object.name !== 'string') name = object.palette.name
    }
  } else if (extension === 'gpl' || /GIMP Palette/i.test(text.slice(0, 100))) {
    const nameLine = text.split(/\r?\n/).find((line) => /^Name:/i.test(line.trim()))
    if (nameLine) name = nameLine.replace(/^Name:\s*/i, '').trim() || name
    colors = text.split(/\r?\n/).flatMap((line) => {
      const match = line.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+.*)?$/)
      if (!match) return []
      const rgb = match.slice(1, 4).map(Number)
      if (rgb.some((value) => value < 0 || value > 255)) return []
      return [`#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`]
    })
  } else {
    colors = text.split(/\r?\n/).flatMap((line) => {
      const trimmed = line.trim()
      const marked = trimmed.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?/ig)
      if (marked?.length) return marked
      const plain = trimmed.match(/^([0-9a-f]{6})(?:\s+.*)?$/i)
      return plain ? [`#${plain[1]}`] : []
    })
  }
  const cleaned = uniqueColors(colors)
  if (!cleaned.length) throw new Error('В файле не найдено цветов формата HEX/RGB')
  return { name: name.slice(0, 80), colors: cleaned }
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function exportAsGpl(palette: Palette) {
  const lines = ['GIMP Palette', `Name: ${palette.name}`, 'Columns: 8', '# Exported from Minecraft Texture Studio']
  for (const color of palette.colors) {
    const rgb = hexToRgb(color)
    lines.push(`${String(rgb.r).padStart(3, ' ')} ${String(rgb.g).padStart(3, ' ')} ${String(rgb.b).padStart(3, ' ')} ${color.toUpperCase()}`)
  }
  downloadText(`${palette.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'palette'}.gpl`, `${lines.join('\n')}\n`, 'text/plain;charset=utf-8')
}

type HsvWheelProps = {
  color: string
  onChange: (color: string) => void
}

function HsvWheel({ color, onChange }: HsvWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const hsv = rgbToHsv(parseRgba(color))
  const angle = ((hsv.h - 90) * Math.PI) / 180
  const markerRadius = (Math.min(46, hsv.s * 0.46))
  const markerX = 50 + Math.cos(angle) * markerRadius
  const markerY = 50 + Math.sin(angle) * markerRadius

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = wheelRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy))
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360
    onChange(rgbToHex(hsvToRgb({ h: hue, s: distance * 100, v: hsv.v })))
  }

  return (
    <div
      ref={wheelRef}
      className="ase-hsv-wheel"
      role="slider"
      aria-label="Цветовой круг HSV"
      aria-valuetext={`Hue ${hsv.h}, saturation ${hsv.s}%, value ${hsv.v}%`}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        updateFromPointer(event)
      }}
      onPointerMove={(event) => { if (event.buttons > 0) updateFromPointer(event) }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 2
        const next = { ...hsv }
        if (event.key === 'ArrowLeft') next.h = (next.h - step + 360) % 360
        if (event.key === 'ArrowRight') next.h = (next.h + step) % 360
        if (event.key === 'ArrowUp') next.s = Math.min(100, next.s + step)
        if (event.key === 'ArrowDown') next.s = Math.max(0, next.s - step)
        onChange(rgbToHex(hsvToRgb(next)))
      }}
    >
      <span className="ase-hsv-wheel-marker" style={{ left: `${markerX}%`, top: `${markerY}%`, backgroundColor: color }} />
    </div>
  )
}

export default function PalettePanel({ currentColor, secondaryColor, activeColorSlot, onSelectColor, onSelectSlot, onNotice }: Props) {
  const { openContextMenu } = useContextMenu()
  const [userPalettes, setUserPalettes] = useState<Palette[]>(readStoredPalettes)
  const [paletteName, setPaletteName] = useState(() => { try { return localStorage.getItem('mts-active-palette-v1') ?? palettes[0].name } catch { return palettes[0].name } })
  const [customColors, setCustomColors] = useState<string[]>(() => readStoredStringArray('mts-saved-colors-v1'))
  const [editingColor, setEditingColor] = useState(currentColor)
  const [selectedColorIndex, setSelectedColorIndex] = useState<number | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [colorWindowOpen, setColorWindowOpen] = useState(false)
  const [colorBaseline, setColorBaseline] = useState('#4ba3ff')
  const [paletteToDelete, setPaletteToDelete] = useState<string | null>(null)
  const cancelRenameRef = useRef(false)
  const paletteInputRef = useRef<HTMLInputElement>(null)

  const chosenPalettes = useMemo(() => [...palettes, ...userPalettes], [userPalettes])
  const chosenPalette = chosenPalettes.find((palette) => palette.name === paletteName) ?? chosenPalettes[0]
  const isBuiltin = palettes.some((palette) => palette.name === chosenPalette.name)
  const isMyColors = paletteName === SAVED_COLORS_NAME
  const allColors = isMyColors ? customColors : chosenPalette.colors
  const selectedColorSlotColor = activeColorSlot === 'foreground' ? currentColor : secondaryColor
  const activeHsv = rgbToHsv(parseRgba(selectedColorSlotColor))

  useEffect(() => {
    try { localStorage.setItem('mts-saved-colors-v1', JSON.stringify(customColors)) } catch { /* storage may be disabled */ }
  }, [customColors])
  useEffect(() => {
    try { localStorage.setItem('mts-user-palettes-v1', JSON.stringify(userPalettes)) } catch { /* storage may be disabled */ }
  }, [userPalettes])
  useEffect(() => {
    try { localStorage.setItem('mts-active-palette-v1', paletteName) } catch { /* storage may be disabled */ }
  }, [paletteName])
  useEffect(() => {
    const restoreProjectPalette = () => {
      setUserPalettes(readStoredPalettes())
      setCustomColors(readStoredStringArray('mts-saved-colors-v1'))
      const active = localStorage.getItem('mts-active-palette-v1')
      setPaletteName(active ?? palettes[0].name)
      setSelectedColorIndex(null)
      setRenaming(false)
    }
    window.addEventListener('mts:load-project-palette', restoreProjectPalette)
    return () => window.removeEventListener('mts:load-project-palette', restoreProjectPalette)
  }, [])
  useEffect(() => {
    setEditingColor(selectedColorSlotColor)
    const matchingIndex = allColors.findIndex((color) => color.toLowerCase() === selectedColorSlotColor.toLowerCase())
    setSelectedColorIndex(matchingIndex >= 0 ? matchingIndex : null)
  }, [activeColorSlot, selectedColorSlotColor, paletteName])

  const selectPalette = (name: string) => {
    setPaletteName(name)
    setSelectedColorIndex(null)
    setRenaming(false)
    onNotice?.(`Палитра: ${name}`)
  }

  const selectColor = (value: string, index: number | null = null) => {
    const normalized = normalizeColor(value)
    if (!normalized) return
    setEditingColor(normalized)
    setSelectedColorIndex(index)
    onSelectColor(normalized)
  }

  const uniquePaletteName = (base: string, exceptName?: string) => {
    // "Мои цвета" is a reserved pseudo-palette, so user palettes must not take that name.
    const names = new Set([
      SAVED_COLORS_NAME,
      ...palettes.map((palette) => palette.name),
      ...userPalettes.map((palette) => palette.name),
    ].filter((name) => name !== exceptName))
    let name = base.slice(0, 75) || 'Моя палитра'
    let suffix = 2
    while (names.has(name)) name = `${base.slice(0, 70)} ${suffix++}`
    return name
  }

  const createPalette = () => {
    const name = uniquePaletteName('Новая палитра')
    const created = { name, colors: [normalizeColor(activeColorSlot === 'foreground' ? currentColor : secondaryColor) ?? '#4ba3ff'] }
    setUserPalettes((previous) => [...previous, created])
    setPaletteName(name)
    setSelectedColorIndex(0)
    setEditingColor(created.colors[0])
    setRenaming(false)
    onNotice?.(`Создана палитра «${name}»`)
  }

  const duplicatePalette = () => {
    const source = isMyColors ? { name: SAVED_COLORS_NAME, colors: customColors } : chosenPalette
    const name = uniquePaletteName(`${source.name} — копия`)
    const copy = { name, colors: [...source.colors] }
    setUserPalettes((previous) => [...previous, copy])
    setPaletteName(name)
    setSelectedColorIndex(null)
    onNotice?.(`Создана копия «${name}»`)
  }

  const startRename = () => {
    if (isBuiltin || isMyColors) return
    setRenameDraft(chosenPalette.name)
    setRenaming(true)
  }

  const commitRename = () => {
    if (!renaming) return
    if (cancelRenameRef.current) { cancelRenameRef.current = false; return }
    const trimmed = renameDraft.trim()
    if (!trimmed || isBuiltin || isMyColors) { setRenaming(false); return }
    const name = uniquePaletteName(trimmed, chosenPalette.name)
    setUserPalettes((previous) => previous.map((palette) => palette.name === chosenPalette.name ? { ...palette, name } : palette))
    setPaletteName(name)
    setRenaming(false)
    onNotice?.(`Палитра переименована: ${name}`)
  }

  const cancelRename = () => {
    cancelRenameRef.current = true
    setRenaming(false)
  }

  const makeEditablePalette = (): string => {
    if (isMyColors) return SAVED_COLORS_NAME
    if (!isBuiltin) return chosenPalette.name
    const name = uniquePaletteName(`${chosenPalette.name} — копия`)
    const cloned = { name, colors: [...chosenPalette.colors] }
    setUserPalettes((previous) => [...previous, cloned])
    setPaletteName(name)
    onNotice?.(`Создана редактируемая копия «${name}»`)
    return name
  }

  const updateEditingColor = (value: string) => {
    const normalized = normalizeRgbaColor(value)
    if (!normalized) return
    setEditingColor(normalized)
    onSelectColor(normalized)
    if (selectedColorIndex === null) return
    const paletteColor = opaqueColor(normalized)
    if (isMyColors) {
      setCustomColors((previous) => previous.map((color, index) => index === selectedColorIndex ? paletteColor : color))
      return
    }
    const paletteToEdit = makeEditablePalette()
    setUserPalettes((previous) => previous.map((palette) => palette.name === paletteToEdit
      ? { ...palette, colors: palette.colors.map((color, index) => index === selectedColorIndex ? paletteColor : color) }
      : palette))
  }

  const applyHsvHex = (hex: string) => {
    // Hue/saturation/value edits keep the current alpha instead of resetting it.
    updateEditingColor(withAlpha(hex, parseRgba(selectedColorSlotColor).a))
  }

  const openColorWindow = () => {
    if (!colorWindowOpen) setColorBaseline(selectedColorSlotColor)
    setColorWindowOpen(true)
  }

  useEffect(() => {
    // Switching the target slot while the A/B window is open restarts the comparison.
    if (colorWindowOpen) setColorBaseline(activeColorSlot === 'foreground' ? currentColor : secondaryColor)
  }, [activeColorSlot])

  const addColor = () => {
    const parsed = normalizeRgbaColor(editingColor)
    const color = parsed ? opaqueColor(parsed) : '#4ba3ff'
    if (isMyColors) {
      setCustomColors((previous) => [...previous, color])
      setSelectedColorIndex(customColors.length)
    } else {
      const paletteToEdit = makeEditablePalette()
      setUserPalettes((previous) => previous.map((palette) => palette.name === paletteToEdit ? { ...palette, colors: [...palette.colors, color] } : palette))
      setPaletteName(paletteToEdit)
      setSelectedColorIndex(chosenPalette.colors.length)
    }
    onSelectColor(color)
    onNotice?.(`Добавлен цвет ${color.toUpperCase()}`)
  }

  const deleteColor = () => {
    if (selectedColorIndex === null) return
    const index = selectedColorIndex
    if (isMyColors) {
      setCustomColors((previous) => previous.filter((_, colorIndex) => colorIndex !== index))
    } else {
      const paletteToEdit = makeEditablePalette()
      setUserPalettes((previous) => previous.map((palette) => palette.name === paletteToEdit ? { ...palette, colors: palette.colors.filter((_, colorIndex) => colorIndex !== index) } : palette))
      setPaletteName(paletteToEdit)
    }
    setSelectedColorIndex(null)
    onNotice?.('Цвет удалён из палитры')
  }

  const deletePalette = () => {
    if (isBuiltin || isMyColors) return
    setPaletteToDelete(chosenPalette.name)
  }

  const confirmDeletePalette = () => {
    if (!paletteToDelete) return
    setUserPalettes((previous) => previous.filter((palette) => palette.name !== paletteToDelete))
    setPaletteName(palettes[0].name)
    setSelectedColorIndex(null)
    setPaletteToDelete(null)
    onNotice?.('Палитра удалена')
  }

  const importPalette = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = await parsePaletteFile(file)
      const name = uniquePaletteName(imported.name)
      imported.name = name
      setUserPalettes((previous) => [...previous, imported])
      setPaletteName(name)
      setSelectedColorIndex(imported.colors.length ? 0 : null)
      if (imported.colors[0]) selectColor(imported.colors[0], 0)
      onNotice?.(`Загружена палитра «${name}» · ${imported.colors.length} цветов`)
    } catch (error) {
      onNotice?.(error instanceof Error ? `Не удалось загрузить палитру: ${error.message}` : 'Не удалось загрузить палитру')
    } finally {
      event.target.value = ''
    }
  }

  const cycleColor = (direction: -1 | 1) => {
    if (!allColors.length) return
    const activeColor = activeColorSlot === 'foreground' ? currentColor : secondaryColor
    const activeIndex = allColors.findIndex((color) => color.toLowerCase() === activeColor.toLowerCase())
    const startIndex = activeIndex >= 0 ? activeIndex : (direction > 0 ? -1 : 0)
    const nextIndex = (startIndex + direction + allColors.length) % allColors.length
    selectColor(allColors[nextIndex], nextIndex)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || event.ctrlKey || event.altKey || event.metaKey) return
      // The shortcut editor and the color window own the keyboard while open.
      if (document.querySelector('.shortcuts-modal') || document.querySelector('.color-editor-window')) return
      if (event.key === '[') { event.preventDefault(); cycleColor(-1) }
      if (event.key === ']') { event.preventDefault(); cycleColor(1) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [allColors, currentColor, secondaryColor, activeColorSlot, selectedColorIndex])

  const exportCurrent = () => {
    const selected: Palette = isMyColors ? { name: SAVED_COLORS_NAME, colors: customColors } : { name: chosenPalette.name, colors: allColors }
    exportAsGpl(selected)
  }

  return (
    <section className="side-section palette-section aseprite-palette-panel" onContextMenu={(event) => {
      const target = event.target
      // Preserve native text-editing actions for color fields and the palette dropdown.
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return
      openContextMenu(event, [
        { label: 'Создать палитру', action: createPalette },
        { label: 'Дублировать палитру', action: duplicatePalette },
        { separator: true },
        { label: 'Импортировать палитру…', action: () => paletteInputRef.current?.click() },
        { label: 'Экспортировать текущую палитру…', action: exportCurrent },
      ])
    }}>
      <div className="section-heading"><span>ПАЛИТРА</span><span className="mini-count">{allColors.length} цветов</span></div>

      <div className="ase-palette-name-row">
        <select className="select-control palette-select" value={paletteName} onChange={(event) => selectPalette(event.target.value)} aria-label="Выбрать палитру">
          {chosenPalettes.map((palette, index) => <option key={`${palette.name}-${index}`} value={palette.name}>{palette.name}</option>)}
          {(customColors.length > 0 || paletteName === SAVED_COLORS_NAME) && <option value={SAVED_COLORS_NAME}>{SAVED_COLORS_NAME}</option>}
        </select>
        <button type="button" className="icon-button small-icon-button" onClick={startRename} disabled={isBuiltin || isMyColors} title="Переименовать палитру"><Pencil size={13} /></button>
      </div>

      {renaming && (
        <div className="ase-rename-row">
          <input
            value={renameDraft}
            autoFocus
            aria-label="Название палитры"
            onChange={(event) => setRenameDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') cancelRename()
            }}
          />
          <button type="button" className="icon-button small-icon-button" onMouseDown={(event) => event.preventDefault()} onClick={commitRename} title="Сохранить"><Check size={13} /></button>
          <button type="button" className="icon-button small-icon-button" onMouseDown={(event) => event.preventDefault()} onClick={cancelRename} title="Отмена"><X size={13} /></button>
        </div>
      )}

      <div className="palette-grid palette-grid-main ase-swatch-grid" aria-label="Цвета палитры">
        {allColors.map((swatch, index) => (
          <button key={`${swatch}-${index}`} type="button" className={`swatch ${selectedColorSlotColor.toLowerCase() === swatch.toLowerCase() ? 'swatch-active' : ''}`} style={{ backgroundColor: swatch }} title={`${index + 1}: ${swatch} · выбрать цвет`} onClick={() => selectColor(swatch, index)} onContextMenu={(event) => openContextMenu(event, [
            { label: 'Основной цвет (FG)', checked: activeColorSlot === 'foreground' && currentColor.toLowerCase() === swatch.toLowerCase(), action: () => { onSelectSlot('foreground'); onSelectColor(swatch) } },
            { label: 'Фоновый цвет (BG)', checked: activeColorSlot === 'background' && secondaryColor.toLowerCase() === swatch.toLowerCase(), action: () => { onSelectSlot('background'); onSelectColor(swatch) } },
            { separator: true },
            { label: 'Копировать HEX', icon: <Copy size={13} />, action: () => { if (!navigator.clipboard) { onNotice?.('Буфер обмена недоступен в этом окружении'); return } void navigator.clipboard.writeText(swatch).then(() => onNotice?.(`Скопирован ${swatch.toUpperCase()}`)).catch(() => onNotice?.('Не удалось скопировать цвет')) } },
          ])} />
        ))}
        {!allColors.length && <div className="palette-empty">Палитра пуста. Добавь цвет кнопкой ниже.</div>}
      </div>

      <div className="ase-color-wheel-wrap">
        <HsvWheel color={selectedColorSlotColor} onChange={applyHsvHex} />
        <input
          className="ase-value-slider"
          aria-label="Яркость цвета"
          type="range"
          min="0"
          max="100"
          value={activeHsv.v}
          style={{ '--value-color': rgbToHex(hsvToRgb({ ...activeHsv, v: 100 })) } as CSSProperties}
          onChange={(event) => applyHsvHex(rgbToHex(hsvToRgb({ ...activeHsv, v: Number(event.target.value) })))}
        />
      </div>

      <div className="ase-color-index-row">
        <span className="ase-color-index">Idx-{selectedColorIndex === null ? '—' : selectedColorIndex + 1}</span>
        <div className="ase-slot-switch" role="group" aria-label="Цветовой слот">
          <button type="button" className={activeColorSlot === 'foreground' ? 'active' : ''} onClick={() => onSelectSlot('foreground')} title="Основной цвет (ЛКМ)"><i style={{ background: currentColor }} />FG</button>
          <button type="button" className={activeColorSlot === 'background' ? 'active' : ''} onClick={() => onSelectSlot('background')} title="Фоновый цвет (ПКМ)"><i style={{ background: secondaryColor }} />BG</button>
        </div>
        <button type="button" className="icon-button small-icon-button ase-color-cycle" onClick={() => cycleColor(-1)} title="Предыдущий цвет ["><ChevronLeft size={14} /></button>
        <button type="button" className="icon-button small-icon-button ase-color-cycle" onClick={() => cycleColor(1)} title="Следующий цвет ]"><ChevronRight size={14} /></button>
      </div>

      <div className="ase-hex-row">
        <span>HEX</span>
        <input
          value={editingColor}
          aria-label="HEX текущего цвета"
          onChange={(event) => {
            const value = event.target.value
            setEditingColor(value)
            const normalized = normalizeRgbaColor(value)
            if (normalized) updateEditingColor(normalized)
          }}
          onBlur={() => {
            const normalized = normalizeRgbaColor(editingColor)
            if (normalized) updateEditingColor(normalized)
            else setEditingColor(selectedColorSlotColor)
          }}
        />
        <button
          type="button"
          className="ase-hex-preview"
          style={{ backgroundColor: selectedColorSlotColor }}
          onClick={openColorWindow}
          title="Открыть редактор цвета (HSV/RGB/Alpha, A/B)"
          aria-label="Открыть редактор цвета"
        />
        <button type="button" className="icon-button small-icon-button ase-color-open" onClick={openColorWindow} title="Точная настройка цвета"><SlidersHorizontal size={12} /></button>
      </div>

      <div className="ase-color-actions">
        <button type="button" className="subtle-button" onClick={addColor} title="Добавить текущий цвет в палитру"><Plus size={12} /> Добавить</button>
        <button type="button" className="subtle-button danger-button" onClick={deleteColor} disabled={selectedColorIndex === null} title="Удалить выбранный цвет"><Trash2 size={12} /> Удалить</button>
      </div>

      <div className="ase-palette-actions">
        <button type="button" className="icon-button small-icon-button" onClick={createPalette} title="Новая палитра"><Plus size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={duplicatePalette} title="Дублировать палитру"><Copy size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={startRename} disabled={isBuiltin || isMyColors} title="Переименовать палитру"><Pencil size={13} /></button>
        <button type="button" className="icon-button small-icon-button danger-icon" onClick={deletePalette} disabled={isBuiltin || isMyColors} title="Удалить палитру"><Trash2 size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={() => paletteInputRef.current?.click()} title="Импорт палитры (.gpl/.hex/.txt/.json)"><Upload size={13} /></button>
        <button type="button" className="icon-button small-icon-button" onClick={exportCurrent} title="Экспорт палитры (.gpl)"><Download size={13} /></button>
      </div>
      <input ref={paletteInputRef} type="file" accept=".gpl,.hex,.txt,.json,text/plain,application/json" onChange={importPalette} hidden />
      <p className="panel-note">[ / ] — предыдущий / следующий цвет. Круг и HEX меняют цвет активного слота, «Добавить» сохраняет его в палитру.</p>
      {colorWindowOpen && (
        <ColorEditorWindow
          color={selectedColorSlotColor}
          baselineColor={colorBaseline}
          slotLabel={activeColorSlot === 'foreground' ? 'FG' : 'BG'}
          onPreview={updateEditingColor}
          onClose={() => setColorWindowOpen(false)}
        />
      )}
      <ConfirmDialog
        open={paletteToDelete !== null}
        title="Удаление палитры"
        message={`Удалить палитру «${paletteToDelete ?? ''}»? Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        danger
        onConfirm={confirmDeletePalette}
        onCancel={() => setPaletteToDelete(null)}
      />
    </section>
  )
}
