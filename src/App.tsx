import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react'
import {
  Brush, Eraser, PaintBucket, Pipette, Undo2, Redo2, FolderOpen, Download,
  Eye, Grid2X2, Keyboard, RotateCw, PanelsTopLeft, Box, ChevronDown, ChevronUp,
  FileImage, CircleHelp, Maximize2, Layers3, Sparkles, MousePointer2, ZoomIn, ZoomOut, UserRound,
  Paintbrush, ScanLine, PersonStanding, ArrowLeftRight, Save, FileUp,
  SquareDashedMousePointer, Slash, Square, Circle, Copy, Scissors, ClipboardPaste, Trash2, Merge, Plus,
  FlipHorizontal, FlipVertical, RefreshCw, RotateCcw,
} from 'lucide-react'
import TextureCanvas from './components/TextureCanvas'
import ElytraViewer from './components/ElytraViewer'
import PalettePanel from './components/PalettePanel'
import LayersPanel from './components/LayersPanel'
import ShortcutsModal, { defaultShortcuts } from './components/ShortcutsModal'
import { useContextMenu } from './components/ContextMenu'
import type { ContextMenuItem } from './components/ContextMenu'
import type { ShortcutId, ShortcutMap } from './components/ShortcutsModal'
import { makeStarterTexture, transparentPixel } from './data/palettes'
import {
  clearRegion, copyRegion, exportPixelsAsPng, floodFill, paintPoints, pasteRegion, readImageFile,
  TEXTURE_HEIGHT, TEXTURE_WIDTH,
} from './utils/texture'
import type { PixelRegion } from './utils/texture'
import {
  cloneLayer, compositeLayers, createLayer, emptyLayerPixels, layersFromPixels, mergeLayerPixels,
  moveLayer as moveLayerInStack, nextLayerName,
} from './utils/layers'
import type { Layer } from './utils/layers'
import { isPixelArray, parseProjectLayers } from './utils/project'
import { applyTransform, blitBlock, blockSelection, extractBlock, scaleBlock } from './utils/transform'
import type { PixelBlock, TransformKind, TransformRect } from './utils/transform'
import { linePoints, rectHeight, rectWidth, shapePoints } from './utils/shapes'
import type { SelectionRect, Shape } from './utils/shapes'

export type ToolId = 'select' | 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'ellipse'
type ViewMode = '2d' | 'split' | '3d'

type Snapshot = { layers: Layer[]; activeLayerId: string }

type FloatingTransform = {
  block: PixelBlock
  source: SelectionRect
  x: number
  y: number
  width: number
  height: number
}

function pixelsEqual(a: string[], b: string[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false
  return true
}

type ProjectSettings = {
  currentColor: string
  secondaryColor: string
  activeColorSlot: 'foreground' | 'background'
  tool: ToolId
  viewMode: ViewMode
  showGrid: boolean
  showUv: boolean
  show3dGrid: boolean
  showModelBounds: boolean
  paintOn3d: boolean
  crouchPinned: boolean
  autoRotate: boolean
  zoom: number
  skinUrl: string | null
  skinFilename: string
}

type ProjectLayerData = {
  id?: string
  name?: string
  visible?: boolean
  opacity?: number
  pixels: string[]
}

type ProjectFileV2 = {
  format: 'minecraft-texture-studio-project'
  version: 2
  filename: string
  activeLayerId: string
  layers: ProjectLayerData[]
  settings: ProjectSettings
  shortcuts: ShortcutMap
  palettes: { userPalettes: unknown; savedColors: unknown; activePalette: string }
}

function readLocalJson(key: string, fallback: unknown): unknown {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value) as unknown
  } catch { return fallback }
}

function toPngFilename(name: string): string {
  const base = name.replace(/\.(png|mts|json)$/i, '').trim()
  return `${base || 'elytra-texture'}.png`
}

function isElytraAtlasSize(width: number, height: number): boolean {
  // The cape/elytra atlas is 64x32; Minecraft still ships 2x and 4x upscales.
  return width >= 64 && width % 64 === 0 && height * 2 === width
}

function toToolId(value: unknown): ToolId | null {
  return value === 'select' || value === 'brush' || value === 'eraser' || value === 'fill' || value === 'eyedropper'
    || value === 'line' || value === 'rect' || value === 'ellipse' ? value : null
}

const tools: Array<{ id: ToolId; label: string; icon: typeof Brush; shortcut: ShortcutId; separatorAfter?: boolean }> = [
  { id: 'select', label: 'Выделение', icon: SquareDashedMousePointer, shortcut: 'select', separatorAfter: true },
  { id: 'brush', label: 'Карандаш', icon: Brush, shortcut: 'brush' },
  { id: 'eraser', label: 'Ластик', icon: Eraser, shortcut: 'eraser' },
  { id: 'fill', label: 'Заливка', icon: PaintBucket, shortcut: 'fill' },
  { id: 'eyedropper', label: 'Пипетка', icon: Pipette, shortcut: 'eyedropper', separatorAfter: true },
  { id: 'line', label: 'Линия', icon: Slash, shortcut: 'line' },
  { id: 'rect', label: 'Прямоугольник', icon: Square, shortcut: 'rect' },
  { id: 'ellipse', label: 'Эллипс', icon: Circle, shortcut: 'ellipse' },
]

function shortcutMatches(event: KeyboardEvent, shortcut: string): boolean {
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  const parts = shortcut.split('+')
  const targetKey = parts[parts.length - 1]
  const wantsCtrl = parts.includes('Ctrl')
  const wantsAlt = parts.includes('Alt')
  const wantsShift = parts.includes('Shift')
  return key === targetKey && Boolean(event.ctrlKey || event.metaKey) === wantsCtrl && event.altKey === wantsAlt && event.shiftKey === wantsShift
}

export default function App() {
  const { openContextMenu } = useContextMenu()
  const [layers, setLayers] = useState<Layer[]>(() => [createLayer('Слой 1', makeStarterTexture())])
  const [activeLayerId, setActiveLayerId] = useState(() => layers[0].id)
  const layersRef = useRef(layers)
  const activeLayerIdRef = useRef(activeLayerId)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [clipboard, setClipboard] = useState<PixelRegion | null>(null)
  const [floating, setFloating] = useState<FloatingTransform | null>(null)
  const transformSnapshotRef = useRef<Snapshot | null>(null)
  const [currentColor, setCurrentColor] = useState('#4ba3ff')
  const [secondaryColor, setSecondaryColor] = useState('#ffffff')
  const [activeColorSlot, setActiveColorSlot] = useState<'foreground' | 'background'>('foreground')
  const [tool, setTool] = useState<ToolId>('brush')
  const previousToolRef = useRef<ToolId>('brush')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [showGrid, setShowGrid] = useState(true)
  const [showUv, setShowUv] = useState(true)
  const [show3dGrid, setShow3dGrid] = useState(false)
  const [showModelBounds, setShowModelBounds] = useState(false)
  const [paintOn3d, setPaintOn3d] = useState(true)
  const [crouchPinned, setCrouchPinned] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const crouching = crouchPinned || shiftHeld
  const [autoRotate, setAutoRotate] = useState(false)
  const [zoom, setZoom] = useState(10)
  const [cursorPos, setCursorPos] = useState<[number, number]>([0, 0])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
    try {
      const saved = localStorage.getItem('mts-shortcuts-v1')
      if (!saved) return defaultShortcuts
      const parsed = JSON.parse(saved) as Partial<ShortcutMap>
      if (parsed.export === 'Ctrl+S') parsed.export = 'Ctrl+Shift+E'
      return { ...defaultShortcuts, ...parsed }
    } catch { return defaultShortcuts }
  })
  const [history, setHistory] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const historyRef = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])
  const pendingHistoryRef = useRef<Snapshot | null>(null)
  // A brush stroke is many pointermove commits but a single undo step. The first
  // changed pixel of a stroke pushes the snapshot; the rest only update pixels.
  const strokeActiveRef = useRef(false)
  const strokeSnapshotPushedRef = useRef(false)
  const importModeRef = useRef<'active' | 'new'>('active')
  const [filename, setFilename] = useState('elytra-texture.png')
  const [skinUrl, setSkinUrl] = useState<string | null>(null)
  const [skinFilename, setSkinFilename] = useState('')
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('Готово к рисованию')
  const [helpOpen, setHelpOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const skinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { activeLayerIdRef.current = activeLayerId }, [activeLayerId])

  // The canvas, the 3D preview and PNG export all show the flattened stack.
  const pixels = useMemo(() => compositeLayers(layers), [layers])
  // While a selection is being moved/resized, the active layer already has the source
  // area cleared; draw the floating pixels on top for a live preview.
  const displayPixels = useMemo(() => {
    if (!floating) return pixels
    const scaled = floating.width === floating.block.width && floating.height === floating.block.height
      ? floating.block
      : scaleBlock(floating.block, floating.width, floating.height)
    return blitBlock(pixels, scaled, floating.x, floating.y)
  }, [pixels, floating])
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[layers.length - 1]
  const activeLayerIndex = layers.findIndex((layer) => layer.id === activeLayerId)
  const displaySelection: SelectionRect | null = floating
    ? { x0: floating.x, y0: floating.y, x1: floating.x + floating.width - 1, y1: floating.y + floating.height - 1 }
    : selection

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}Minecraft Texture Studio — ${filename || 'elytra-texture.png'}`
  }, [dirty, filename])

  const currentSnapshot = useCallback((): Snapshot => ({ layers: layersRef.current, activeLayerId: activeLayerIdRef.current }), [])

  const pushHistory = useCallback(() => {
    const nextHistory = [...historyRef.current.slice(-79), currentSnapshot()]
    historyRef.current = nextHistory
    setHistory(nextHistory)
    futureRef.current = []
    setFuture([])
  }, [currentSnapshot])

  const applyLayers = useCallback((next: Layer[], label: string, nextActiveId?: string) => {
    layersRef.current = next
    setLayers(next)
    if (nextActiveId && nextActiveId !== activeLayerIdRef.current) {
      activeLayerIdRef.current = nextActiveId
      setActiveLayerId(nextActiveId)
    }
    setDirty(true)
    setStatus(label)
  }, [])

  const getActivePixels = useCallback((): string[] => {
    const layer = layersRef.current.find((item) => item.id === activeLayerIdRef.current)
    return layer ? layer.pixels : []
  }, [])

  const requireEditableActiveLayer = useCallback((): boolean => {
    const layer = layersRef.current.find((item) => item.id === activeLayerIdRef.current)
    if (!layer) { setStatus('Нет активного слоя'); return false }
    if (!layer.visible) { setStatus(`Слой «${layer.name}» скрыт — включи его видимость`); return false }
    return true
  }, [])

  const commitLayerPixels = useCallback((nextPixels: string[], label: string) => {
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    if (index < 0) return
    const layer = current[index]
    if (nextPixels === layer.pixels || nextPixels.length !== layer.pixels.length) return
    let changed = false
    for (let i = 0; i < nextPixels.length; i++) {
      if (nextPixels[i] !== layer.pixels[i]) { changed = true; break }
    }
    if (!changed) return
    if (strokeActiveRef.current && strokeSnapshotPushedRef.current) {
      // Already part of the current stroke: do not create a second undo step.
    } else {
      pushHistory()
      if (strokeActiveRef.current) strokeSnapshotPushedRef.current = true
    }
    applyLayers(current.map((item, itemIndex) => itemIndex === index ? { ...item, pixels: nextPixels } : item), label)
  }, [applyLayers, pushHistory])

  const beginStroke = useCallback(() => {
    strokeActiveRef.current = true
    strokeSnapshotPushedRef.current = false
  }, [])

  const endStroke = useCallback(() => {
    strokeActiveRef.current = false
    strokeSnapshotPushedRef.current = false
  }, [])

  const undo = useCallback(() => {
    const list = historyRef.current
    if (!list.length) return
    endStroke()
    const previous = list[list.length - 1]
    const nextHistory = list.slice(0, -1)
    const nextFuture = [currentSnapshot(), ...futureRef.current].slice(0, 80)
    historyRef.current = nextHistory
    futureRef.current = nextFuture
    setHistory(nextHistory)
    setFuture(nextFuture)
    layersRef.current = previous.layers
    activeLayerIdRef.current = previous.activeLayerId
    setLayers(previous.layers)
    setActiveLayerId(previous.activeLayerId)
    setDirty(true)
    setStatus('Действие отменено')
  }, [currentSnapshot, endStroke])

  const redo = useCallback(() => {
    const list = futureRef.current
    if (!list.length) return
    endStroke()
    const target = list[0]
    const nextHistory = [...historyRef.current, currentSnapshot()].slice(-80)
    const nextFuture = list.slice(1)
    historyRef.current = nextHistory
    futureRef.current = nextFuture
    setHistory(nextHistory)
    setFuture(nextFuture)
    layersRef.current = target.layers
    activeLayerIdRef.current = target.activeLayerId
    setLayers(target.layers)
    setActiveLayerId(target.activeLayerId)
    setDirty(true)
    setStatus('Действие повторено')
  }, [currentSnapshot, endStroke])

  // ----- drawing -----------------------------------------------------------

  const paint = useCallback((x0: number, y0: number, x1: number, y1: number, color: string) => {
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(paintPoints(getActivePixels(), linePoints(x0, y0, x1, y1), color, selection), color === transparentPixel ? 'Ластик' : 'Рисование')
  }, [commitLayerPixels, getActivePixels, requireEditableActiveLayer, selection])

  const fill = useCallback((x: number, y: number, fillColor = currentColor) => {
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(floodFill(getActivePixels(), x, y, fillColor, selection), 'Заливка области')
  }, [commitLayerPixels, currentColor, getActivePixels, requireEditableActiveLayer, selection])

  const drawShape = useCallback((shape: Shape, shapeColor: string) => {
    if (!requireEditableActiveLayer()) return
    const label = shape.kind === 'line' ? 'Линия' : shape.kind === 'rect' ? 'Прямоугольник' : 'Эллипс'
    commitLayerPixels(paintPoints(getActivePixels(), shapePoints(shape), shapeColor, selection), label)
  }, [commitLayerPixels, getActivePixels, requireEditableActiveLayer, selection])

  const handleSelectionChange = useCallback((next: SelectionRect | null) => {
    setSelection(next)
    setStatus(next ? `Выделение ${rectWidth(next)}×${rectHeight(next)}` : 'Выделение снято')
  }, [])

  // ----- clipboard ---------------------------------------------------------

  const effectiveSelection = useCallback((): SelectionRect => selection ?? { x0: 0, y0: 0, x1: TEXTURE_WIDTH - 1, y1: TEXTURE_HEIGHT - 1 }, [selection])

  const copySelection = useCallback(() => {
    const region = copyRegion(getActivePixels(), effectiveSelection())
    if (!region) return
    setClipboard(region)
    setStatus(`Скопировано ${region.width}×${region.height}`)
  }, [effectiveSelection, getActivePixels])

  // Copies what the artist actually sees: the flattened visible stack, not just the
  // active layer. Essential when shading and highlights live on separate layers.
  const copyMerged = useCallback(() => {
    const region = copyRegion(pixels, effectiveSelection())
    if (!region) return
    setClipboard(region)
    setStatus(`Скопировано объединённое ${region.width}×${region.height}`)
  }, [effectiveSelection, pixels])

  const cutSelection = useCallback(() => {
    const region = copyRegion(getActivePixels(), effectiveSelection())
    if (!region) return
    setClipboard(region)
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(clearRegion(getActivePixels(), effectiveSelection()), 'Вырезано в буфер')
  }, [commitLayerPixels, effectiveSelection, getActivePixels, requireEditableActiveLayer])

  const pasteClipboard = useCallback(() => {
    if (!clipboard) { setStatus('Внутренний буфер пуст'); return }
    if (!requireEditableActiveLayer()) return
    const originX = selection ? selection.x0 : 0
    const originY = selection ? selection.y0 : 0
    commitLayerPixels(pasteRegion(getActivePixels(), clipboard, originX, originY), 'Вставка из буфера')
    setSelection({
      x0: originX,
      y0: originY,
      x1: Math.min(TEXTURE_WIDTH - 1, originX + clipboard.width - 1),
      y1: Math.min(TEXTURE_HEIGHT - 1, originY + clipboard.height - 1),
    })
  }, [clipboard, commitLayerPixels, getActivePixels, requireEditableActiveLayer, selection])

  const pasteClipboardAsNewLayer = useCallback(() => {
    if (!clipboard) { setStatus('Внутренний буфер пуст'); return }
    const originX = selection ? selection.x0 : 0
    const originY = selection ? selection.y0 : 0
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    pushHistory()
    const layer = createLayer('Вставка', emptyLayerPixels())
    layer.pixels = pasteRegion(layer.pixels, clipboard, originX, originY)
    const insertAt = index < 0 ? current.length : index + 1
    applyLayers([...current.slice(0, insertAt), layer, ...current.slice(insertAt)], 'Вставлено в новый слой', layer.id)
    setSelection({
      x0: originX,
      y0: originY,
      x1: Math.min(TEXTURE_WIDTH - 1, originX + clipboard.width - 1),
      y1: Math.min(TEXTURE_HEIGHT - 1, originY + clipboard.height - 1),
    })
  }, [applyLayers, clipboard, pushHistory, selection])

  const deleteSelection = useCallback(() => {
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(clearRegion(getActivePixels(), effectiveSelection()), 'Выделение очищено')
  }, [commitLayerPixels, effectiveSelection, getActivePixels, requireEditableActiveLayer])

  const selectAll = useCallback(() => {
    setSelection({ x0: 0, y0: 0, x1: TEXTURE_WIDTH - 1, y1: TEXTURE_HEIGHT - 1 })
    setStatus('Выделен весь холст')
  }, [])

  const deselect = useCallback(() => {
    setSelection(null)
    setStatus('Выделение снято')
  }, [])

  // ----- selection transform ----------------------------------------------

  const beginSelectionTransform = useCallback((): boolean => {
    if (!selection) return false
    if (floating) return true
    if (!requireEditableActiveLayer()) return false
    const source = selection
    const block = extractBlock(getActivePixels(), source)
    const index = layersRef.current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    if (index < 0) return false
    transformSnapshotRef.current = currentSnapshot()
    const cleared = clearRegion(getActivePixels(), source)
    // Apply the cleared layer without touching history: the whole transform becomes
    // one undo step when it is committed.
    const next = layersRef.current.map((layer, layerIndex) => layerIndex === index ? { ...layer, pixels: cleared } : layer)
    layersRef.current = next
    setLayers(next)
    setFloating({ block, source, x: source.x0, y: source.y0, width: block.width, height: block.height })
    setStatus('Трансформация: тяни внутри, тяни за маркеры, поворот — кнопками сверху')
    return true
  }, [currentSnapshot, floating, getActivePixels, requireEditableActiveLayer, selection])

  const updateSelectionTransform = useCallback((rect: TransformRect) => {
    setFloating((current) => current ? { ...current, x: rect.x, y: rect.y, width: rect.width, height: rect.height } : current)
    setStatus(`Выделение ${rect.width}×${rect.height}`)
  }, [])

  const restoreTransformSnapshot = useCallback(() => {
    const snapshot = transformSnapshotRef.current
    if (snapshot) {
      layersRef.current = snapshot.layers
      setLayers(snapshot.layers)
      activeLayerIdRef.current = snapshot.activeLayerId
      setActiveLayerId(snapshot.activeLayerId)
    }
    transformSnapshotRef.current = null
    setFloating(null)
  }, [])

  const cancelSelectionTransform = useCallback(() => {
    restoreTransformSnapshot()
    setStatus('Трансформация отменена')
  }, [restoreTransformSnapshot])

  const commitSelectionTransform = useCallback((rectOverride?: TransformRect) => {
    const active = floating
    if (!active) return
    const rect: TransformRect = rectOverride ?? { x: active.x, y: active.y, width: active.width, height: active.height }
    const unscaled = rect.width === active.block.width && rect.height === active.block.height
    const scaled = unscaled ? active.block : scaleBlock(active.block, rect.width, rect.height)
    const baked = blitBlock(getActivePixels(), scaled, rect.x, rect.y)
    const snapshot = transformSnapshotRef.current
    const snapshotPixels = snapshot?.layers.find((layer) => layer.id === snapshot.activeLayerId)?.pixels
    if (!snapshot || (snapshotPixels && pixelsEqual(baked, snapshotPixels))) {
      // A click or a drag that ended where it started must not pollute the history.
      restoreTransformSnapshot()
      setStatus(`Выделение ${rect.width}×${rect.height}`)
      return
    }
    const nextHistory = [...historyRef.current.slice(-79), snapshot]
    historyRef.current = nextHistory
    setHistory(nextHistory)
    futureRef.current = []
    setFuture([])
    const index = layersRef.current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    if (index >= 0) {
      applyLayers(
        layersRef.current.map((layer, layerIndex) => layerIndex === index ? { ...layer, pixels: baked } : layer),
        `Выделение трансформировано: ${rect.width}×${rect.height}`,
      )
    }
    setSelection(blockSelection(scaled, rect.x, rect.y))
    transformSnapshotRef.current = null
    setFloating(null)
  }, [applyLayers, floating, getActivePixels, restoreTransformSnapshot])

  const transformSelection = useCallback((kind: TransformKind) => {
    if (!selection) { setStatus('Сначала выдели область'); return }
    if (!requireEditableActiveLayer()) return
    const source = selection
    const block = extractBlock(getActivePixels(), source)
    const nextBlock = applyTransform(block, kind)
    const x = source.x0 + Math.floor((block.width - nextBlock.width) / 2)
    const y = source.y0 + Math.floor((block.height - nextBlock.height) / 2)
    const cleared = clearRegion(getActivePixels(), source)
    const baked = blitBlock(cleared, nextBlock, x, y)
    if (pixelsEqual(baked, getActivePixels())) { setStatus('В выделении нет пикселей для трансформации'); return }
    pushHistory()
    const index = layersRef.current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    if (index >= 0) {
      const labels: Record<TransformKind, string> = {
        rotateCW: 'Поворот на 90° по часовой',
        rotateCCW: 'Поворот на 90° против часовой',
        rotate180: 'Поворот на 180°',
        flipH: 'Отражение по горизонтали',
        flipV: 'Отражение по вертикали',
      }
      applyLayers(layersRef.current.map((layer, layerIndex) => layerIndex === index ? { ...layer, pixels: baked } : layer), labels[kind])
    }
    setSelection(blockSelection(nextBlock, x, y))
  }, [applyLayers, getActivePixels, pushHistory, requireEditableActiveLayer, selection])

  // ----- layers ------------------------------------------------------------

  const selectLayer = useCallback((id: string) => {
    const layer = layersRef.current.find((item) => item.id === id)
    if (!layer) return
    activeLayerIdRef.current = id
    setActiveLayerId(id)
    setStatus(`Слой: ${layer.name}`)
  }, [])

  const addLayer = useCallback(() => {
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    pushHistory()
    const layer = createLayer(nextLayerName(current))
    const insertAt = index < 0 ? current.length : index + 1
    applyLayers([...current.slice(0, insertAt), layer, ...current.slice(insertAt)], `Создан слой «${layer.name}»`, layer.id)
  }, [applyLayers, pushHistory])

  const duplicateLayer = useCallback((id: string) => {
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === id)
    if (index < 0) return
    pushHistory()
    const copy = cloneLayer(current[index])
    applyLayers([...current.slice(0, index + 1), copy, ...current.slice(index + 1)], `Дублирован слой «${current[index].name}»`, copy.id)
  }, [applyLayers, pushHistory])

  const deleteLayer = useCallback((id: string) => {
    const current = layersRef.current
    if (current.length < 2) { setStatus('Нельзя удалить единственный слой'); return }
    const index = current.findIndex((layer) => layer.id === id)
    if (index < 0) return
    pushHistory()
    const next = current.filter((layer) => layer.id !== id)
    const fallback = next[Math.min(index, next.length - 1)]
    applyLayers(next, 'Слой удалён', id === activeLayerIdRef.current ? fallback.id : activeLayerIdRef.current)
  }, [applyLayers, pushHistory])

  const moveLayerBy = useCallback((id: string, direction: 1 | -1) => {
    const current = layersRef.current
    const next = moveLayerInStack(current, id, direction)
    if (next === current) return
    pushHistory()
    applyLayers(next, direction > 0 ? 'Слой поднят' : 'Слой опущен')
  }, [applyLayers, pushHistory])

  const mergeDown = useCallback((id: string) => {
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === id)
    if (index <= 0) { setStatus('Ниже нет слоя для объединения'); return }
    const upper = current[index]
    if (!upper.visible) { setStatus(`Слой «${upper.name}» скрыт — включи видимость для объединения`); return }
    pushHistory()
    const lower = current[index - 1]
    const merged: Layer = { ...lower, pixels: mergeLayerPixels(lower.pixels, upper) }
    const next = current.map((layer, layerIndex) => layerIndex === index - 1 ? merged : layer).filter((_, layerIndex) => layerIndex !== index)
    applyLayers(next, `Слой «${upper.name}» объединён с «${lower.name}»`, merged.id)
  }, [applyLayers, pushHistory])

  const toggleLayerVisibility = useCallback((id: string) => {
    const current = layersRef.current
    const layer = current.find((item) => item.id === id)
    if (!layer) return
    pushHistory()
    applyLayers(current.map((item) => item.id === id ? { ...item, visible: !item.visible } : item), layer.visible ? 'Слой скрыт' : 'Слой показан')
  }, [applyLayers, pushHistory])

  const renameLayer = useCallback((id: string, name: string) => {
    const current = layersRef.current
    const layer = current.find((item) => item.id === id)
    if (!layer || layer.name === name || !name.trim()) return
    pushHistory()
    applyLayers(current.map((item) => item.id === id ? { ...item, name: name.trim() } : item), 'Слой переименован')
  }, [applyLayers, pushHistory])

  const beginOpacityEdit = useCallback(() => { pendingHistoryRef.current = currentSnapshot() }, [currentSnapshot])
  const endOpacityEdit = useCallback(() => { pendingHistoryRef.current = null }, [])

  const setLayerOpacity = useCallback((id: string, value: number) => {
    const current = layersRef.current
    const layer = current.find((item) => item.id === id)
    const clamped = Math.max(0, Math.min(100, Math.round(value)))
    if (!layer || layer.opacity === clamped) return
    const pending = pendingHistoryRef.current
    if (pending) {
      // One undo step per slider gesture: the snapshot was taken on pointerdown.
      const nextHistory = [...historyRef.current.slice(-79), pending]
      historyRef.current = nextHistory
      setHistory(nextHistory)
      futureRef.current = []
      setFuture([])
      pendingHistoryRef.current = null
    } else {
      pushHistory()
    }
    applyLayers(current.map((item) => item.id === id ? { ...item, opacity: clamped } : item), `Прозрачность слоя ${clamped}%`)
  }, [applyLayers, pushHistory])

  // ----- file input --------------------------------------------------------

  const openTexture = useCallback((mode: 'active' | 'new') => {
    importModeRef.current = mode
    fileInputRef.current?.click()
  }, [])
  const openFile = useCallback(() => openTexture('active'), [openTexture])
  const openImportAsNewLayer = useCallback(() => openTexture('new'), [openTexture])
  const openProject = useCallback(() => projectInputRef.current?.click(), [])
  const openSkinFile = useCallback(() => skinInputRef.current?.click(), [])
  const chooseTool = useCallback((nextTool: ToolId) => {
    setTool((currentTool) => {
      if (nextTool !== 'eyedropper') previousToolRef.current = nextTool
      else if (currentTool !== 'eyedropper') previousToolRef.current = currentTool
      return nextTool
    })
  }, [])
  const selectPaletteColor = useCallback((color: string) => {
    if (activeColorSlot === 'foreground') setCurrentColor(color)
    else setSecondaryColor(color)
  }, [activeColorSlot])
  const swapColors = useCallback(() => {
    setCurrentColor(secondaryColor)
    setSecondaryColor(currentColor)
    setStatus('Основной и фоновый цвета поменяны местами')
  }, [currentColor, secondaryColor])
  const exportPng = useCallback(() => {
    const target = toPngFilename(filename)
    exportPixelsAsPng(pixels, target)
    setFilename(target)
    setStatus(`PNG экспортирован: ${target} (слои объединены)`)
  }, [filename, pixels])

  const saveProject = useCallback(() => {
    const project: ProjectFileV2 = {
      format: 'minecraft-texture-studio-project',
      version: 2,
      filename,
      activeLayerId: activeLayerIdRef.current,
      layers: layersRef.current.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        pixels: layer.pixels,
      })),
      settings: {
        currentColor, secondaryColor, activeColorSlot, tool, viewMode, showGrid, showUv,
        show3dGrid, showModelBounds, paintOn3d, crouchPinned, autoRotate, zoom, skinUrl, skinFilename,
      },
      shortcuts,
      palettes: {
        userPalettes: readLocalJson('mts-user-palettes-v1', []),
        savedColors: readLocalJson('mts-saved-colors-v1', []),
        activePalette: localStorage.getItem('mts-active-palette-v1') ?? 'Minecraft · Classic',
      },
    }
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/x-minecraft-texture-studio' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(filename || 'elytra-texture').replace(/\.(png|mts|json)$/i, '') || 'elytra-texture'}.mts`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDirty(false)
    setStatus(`Проект сохранён (.mts) · ${layersRef.current.length} сл.`)
  }, [filename, currentColor, secondaryColor, activeColorSlot, tool, viewMode, showGrid, showUv, show3dGrid, showModelBounds, paintOn3d, crouchPinned, autoRotate, zoom, skinUrl, skinFilename, shortcuts])

  const handlePickColor = useCallback((pickedColor: string) => {
    if (pickedColor !== transparentPixel) selectPaletteColor(pickedColor)
    setTool((activeTool) => activeTool === 'eyedropper' ? previousToolRef.current : activeTool)
  }, [selectPaletteColor])

  const applyProject = (nextLayers: Layer[], requestedActiveId: string, project: { filename?: unknown; settings?: unknown; shortcuts?: unknown; palettes?: unknown }, fileName: string) => {
    layersRef.current = nextLayers
    setLayers(nextLayers)
    const activeId = nextLayers.some((layer) => layer.id === requestedActiveId) ? requestedActiveId : nextLayers[nextLayers.length - 1].id
    activeLayerIdRef.current = activeId
    setActiveLayerId(activeId)
    historyRef.current = []
    futureRef.current = []
    setHistory([])
    setFuture([])
    setSelection(null)
    setClipboard(null)
    setFilename(typeof project.filename === 'string' ? project.filename : 'elytra-texture.png')

    const settings = project.settings as Partial<ProjectSettings>
    if (typeof settings.currentColor === 'string') setCurrentColor(settings.currentColor)
    if (typeof settings.secondaryColor === 'string') setSecondaryColor(settings.secondaryColor)
    if (settings.activeColorSlot === 'foreground' || settings.activeColorSlot === 'background') setActiveColorSlot(settings.activeColorSlot)
    const nextTool = toToolId(settings.tool)
    if (nextTool) chooseTool(nextTool)
    if (settings.viewMode === '2d' || settings.viewMode === 'split' || settings.viewMode === '3d') setViewMode(settings.viewMode)
    if (typeof settings.showGrid === 'boolean') setShowGrid(settings.showGrid)
    if (typeof settings.showUv === 'boolean') setShowUv(settings.showUv)
    if (typeof settings.show3dGrid === 'boolean') setShow3dGrid(settings.show3dGrid)
    if (typeof settings.showModelBounds === 'boolean') setShowModelBounds(settings.showModelBounds)
    if (typeof settings.paintOn3d === 'boolean') setPaintOn3d(settings.paintOn3d)
    if (typeof settings.crouchPinned === 'boolean') setCrouchPinned(settings.crouchPinned)
    if (typeof settings.autoRotate === 'boolean') setAutoRotate(settings.autoRotate)
    if (typeof settings.zoom === 'number' && Number.isFinite(settings.zoom)) setZoom(Math.min(2048, Math.max(2, Math.round(settings.zoom))))
    setSkinUrl(typeof settings.skinUrl === 'string' ? settings.skinUrl : null)
    if (typeof settings.skinFilename === 'string') setSkinFilename(settings.skinFilename)

    if (project.shortcuts && typeof project.shortcuts === 'object') {
      const nextShortcuts = { ...defaultShortcuts, ...project.shortcuts as Partial<ShortcutMap> }
      setShortcuts(nextShortcuts)
      localStorage.setItem('mts-shortcuts-v1', JSON.stringify(nextShortcuts))
    }
    if (project.palettes && typeof project.palettes === 'object') {
      const palettes = project.palettes as { userPalettes?: unknown; savedColors?: unknown; activePalette?: unknown }
      localStorage.setItem('mts-user-palettes-v1', JSON.stringify(palettes.userPalettes ?? []))
      localStorage.setItem('mts-saved-colors-v1', JSON.stringify(palettes.savedColors ?? []))
      localStorage.setItem('mts-active-palette-v1', typeof palettes.activePalette === 'string' ? palettes.activePalette : 'Minecraft · Classic')
      window.dispatchEvent(new CustomEvent('mts:load-project-palette', { detail: project.palettes }))
    }
    setStatus(`Проект загружен: ${fileName}`)
    setDirty(false)
  }

  const handleOpenProjectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Файл проекта повреждён')
      const project = parsed as Record<string, unknown>
      if (project.format !== 'minecraft-texture-studio-project') throw new Error('Неподдерживаемый формат проекта')
      if (project.version !== 1 && project.version !== 2) throw new Error('Неподдерживаемая версия проекта')
      if (typeof project.settings !== 'object' || project.settings === null) throw new Error('В проекте отсутствуют настройки')

      let nextLayers: Layer[]
      let requestedActiveId = ''
      if (project.version === 2) {
        const parsedLayers = parseProjectLayers(project.layers)
        if (!parsedLayers) throw new Error('В проекте нет корректных слоёв 64×32')
        nextLayers = parsedLayers
        requestedActiveId = typeof project.activeLayerId === 'string' ? project.activeLayerId : ''
      } else {
        if (!isPixelArray(project.pixels)) throw new Error('В проекте нет корректной текстуры 64×32')
        nextLayers = layersFromPixels(project.pixels)
      }
      applyProject(nextLayers, requestedActiveId, project, file.name)
    } catch (error) {
      console.error(error)
      setStatus(error instanceof Error ? `Ошибка проекта: ${error.message}` : 'Не удалось открыть проект')
    } finally {
      event.target.value = ''
    }
  }

  const setBinding = useCallback((id: ShortcutId, value: string) => {
    setShortcuts((previous) => {
      const next = { ...previous, [id]: value }
      localStorage.setItem('mts-shortcuts-v1', JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      if (typing || showShortcuts) return
      // While a classic context menu is open it owns the keyboard: arrows navigate, Escape closes.
      if (document.querySelector('.classic-context-menu')) return
      if (event.key === 'Escape' && floating) {
        event.preventDefault()
        cancelSelectionTransform()
        return
      }
      if (event.key === 'Shift' && !event.repeat) { setShiftHeld(true); return }
      const matched = (Object.entries(shortcuts) as Array<[ShortcutId, string]>).find(([, value]) => shortcutMatches(event, value))
      if (!matched) return
      const [action] = matched
      event.preventDefault()
      const toolAction = tools.find((candidate) => candidate.shortcut === action)
      if (toolAction) { chooseTool(toolAction.id); return }
      switch (action) {
        case 'undo': undo(); break
        case 'redo': redo(); break
        case 'open': openFile(); break
        case 'openProject': openProject(); break
        case 'saveProject': saveProject(); break
        case 'export': exportPng(); break
        case 'swapColors': swapColors(); break
        case 'copy': copySelection(); break
        case 'copyMerged': copyMerged(); break
        case 'cut': cutSelection(); break
        case 'paste': pasteClipboard(); break
        case 'pasteNewLayer': pasteClipboardAsNewLayer(); break
        case 'deleteSelection': deleteSelection(); break
        case 'selectAll': selectAll(); break
        case 'deselect': deselect(); break
        case 'toggleUv': setShowUv((value) => !value); break
        case 'toggleGrid':
          if (viewMode === '3d') setShow3dGrid((value) => !value)
          else setShowGrid((value) => !value)
          break
        case 'toggleView': setViewMode((value) => value === '3d' ? 'split' : value === 'split' ? '2d' : 'split'); break
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShiftHeld(false)
    }
    const handleBlur = () => setShiftHeld(false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [shortcuts, showShortcuts, viewMode, undo, redo, openFile, openProject, saveProject, exportPng, swapColors, chooseTool, copySelection, copyMerged, cutSelection, pasteClipboard, pasteClipboardAsNewLayer, deleteSelection, selectAll, deselect, floating, cancelSelectionTransform])

  const handleImportSkin = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    let objectUrl = ''
    try {
      objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      const validLegacy = image.width >= 64 && image.width % 64 === 0 && image.height * 2 === image.width
      const validModern = image.width >= 64 && image.width === image.height && image.width % 64 === 0
      if (!validLegacy && !validModern) {
        throw new Error(`Неверный размер ${image.width}×${image.height}. Нужен скин 64×64, 64×32 или увеличенный вариант этих размеров.`)
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Не удалось прочитать PNG'))
        reader.onerror = () => reject(new Error('Не удалось прочитать PNG'))
        reader.readAsDataURL(file)
      })
      setSkinUrl(dataUrl)
      setSkinFilename(file.name)
      setStatus(`Скин модели загружен: ${file.name}`)
    } catch (error) {
      console.error(error)
      setStatus(error instanceof Error ? error.message : 'Не удалось загрузить скин')
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      event.target.value = ''
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const asNewLayer = importModeRef.current === 'new'
    importModeRef.current = 'active'
    try {
      const imported = await readImageFile(file)
      const sizeNote = isElytraAtlasSize(imported.width, imported.height)
        ? `${imported.width}×${imported.height}`
        : `${imported.width}×${imported.height} растянуто до 64×32`
      pushHistory()
      if (asNewLayer) {
        const current = layersRef.current
        const index = current.findIndex((layer) => layer.id === activeLayerIdRef.current)
        const layerName = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 40) || 'Импорт'
        const layer = createLayer(layerName, imported.pixels)
        const insertAt = index < 0 ? current.length : index + 1
        applyLayers([...current.slice(0, insertAt), layer, ...current.slice(insertAt)], `Импортировано в новый слой «${layerName}» (${sizeNote})`, layer.id)
      } else {
        const next = layersRef.current.map((layer) => layer.id === activeLayerIdRef.current ? { ...layer, pixels: imported.pixels } : layer)
        applyLayers(next, `Импортировано в активный слой: ${file.name} (${sizeNote})`)
      }
      setFilename(toPngFilename(file.name))
    } catch (error) {
      console.error(error)
      setStatus('Не удалось открыть изображение')
    } finally {
      event.target.value = ''
    }
  }

  const resetTexture = () => {
    if (!window.confirm('Создать новую текстуру? Все слои будут заменены.')) return
    pushHistory()
    const layer = createLayer('Слой 1')
    layersRef.current = [layer]
    activeLayerIdRef.current = layer.id
    setLayers([layer])
    setActiveLayerId(layer.id)
    setSelection(null)
    setClipboard(null)
    setFilename('untitled-elytra.png')
    setDirty(true)
    setStatus('Новая пустая текстура')
  }

  const switchView = (mode: ViewMode) => setViewMode(mode)
  const activeGridVisible = viewMode === '3d' ? show3dGrid : showGrid
  const toggleActiveGrid = () => {
    if (viewMode === '3d') setShow3dGrid((value) => !value)
    else setShowGrid((value) => !value)
  }
  const activeGridTitle = viewMode === '3d' ? 'Сетка на 3D-модели' : 'Сетка пикселей 2D'
  const activeToolLabel = tools.find((item) => item.id === tool)?.label ?? 'Карандаш'

  const selectionActions: ContextMenuItem[] = [
    { label: 'Копировать', shortcut: shortcuts.copy, icon: <Copy size={14} />, action: copySelection },
    { label: 'Копировать объединённое', shortcut: shortcuts.copyMerged, icon: <Layers3 size={14} />, action: copyMerged },
    { label: 'Вырезать', shortcut: shortcuts.cut, icon: <Scissors size={14} />, action: cutSelection },
    { label: 'Вставить', shortcut: shortcuts.paste, icon: <ClipboardPaste size={14} />, disabled: !clipboard, action: pasteClipboard },
    { label: 'Вставить в новый слой', shortcut: shortcuts.pasteNewLayer, icon: <Layers3 size={14} />, disabled: !clipboard, action: pasteClipboardAsNewLayer },
    { label: 'Очистить выделение', shortcut: shortcuts.deleteSelection, icon: <Trash2 size={14} />, danger: true, action: deleteSelection },
    { separator: true },
    { label: 'Выделить весь холст', shortcut: shortcuts.selectAll, action: selectAll },
    { label: 'Снять выделение', shortcut: shortcuts.deselect, disabled: !selection, action: deselect },
  ]

  const fileMenu: ContextMenuItem[] = [
    { label: 'Открыть проект…', shortcut: shortcuts.openProject, icon: <FileUp size={14} />, action: openProject },
    { label: 'Сохранить проект…', shortcut: shortcuts.saveProject, icon: <Save size={14} />, action: saveProject },
    { separator: true },
    { label: 'Открыть текстуру…', shortcut: shortcuts.open, icon: <FolderOpen size={14} />, action: openFile },
    { label: 'Импортировать как новый слой…', icon: <Layers3 size={14} />, action: openImportAsNewLayer },
    { label: 'Загрузить скин модели…', icon: <UserRound size={14} />, action: openSkinFile },
    { separator: true },
    { label: 'Экспортировать PNG…', shortcut: shortcuts.export, icon: <Download size={14} />, action: exportPng },
    { separator: true },
    { label: 'Новая пустая текстура', icon: <Sparkles size={14} />, action: resetTexture },
  ]
  const editMenu: ContextMenuItem[] = [
    { label: 'Отменить', shortcut: shortcuts.undo, icon: <Undo2 size={14} />, disabled: history.length === 0, action: undo },
    { label: 'Повторить', shortcut: shortcuts.redo, icon: <Redo2 size={14} />, disabled: future.length === 0, action: redo },
    { separator: true },
    ...selectionActions,
    { separator: true },
    { label: 'Поменять FG / BG', shortcut: shortcuts.swapColors, icon: <ArrowLeftRight size={14} />, action: swapColors },
  ]
  const viewMenu: ContextMenuItem[] = [
    { label: 'Только 2D', checked: viewMode === '2d', action: () => setViewMode('2d') },
    { label: '2D + 3D', checked: viewMode === 'split', action: () => setViewMode('split') },
    { label: 'Только 3D', checked: viewMode === '3d', action: () => setViewMode('3d') },
    { separator: true },
    { label: 'Сетка 2D', checked: showGrid, action: () => setShowGrid((value) => !value) },
    { label: 'UV-направляющие', checked: showUv, action: () => setShowUv((value) => !value) },
    { label: 'Сетка на модели', checked: show3dGrid, action: () => setShow3dGrid((value) => !value) },
    { label: 'Границы геометрии', checked: showModelBounds, action: () => setShowModelBounds((value) => !value) },
  ]
  const layerMenu: ContextMenuItem[] = [
    { label: 'Новый слой', icon: <Plus size={14} />, action: addLayer },
    { label: 'Дублировать слой', icon: <Copy size={14} />, disabled: !activeLayer, action: () => duplicateLayer(activeLayerId) },
    { label: 'Объединить с нижним', icon: <Merge size={14} />, disabled: activeLayerIndex <= 0, action: () => mergeDown(activeLayerId) },
    { separator: true },
    { label: 'Поднять слой', icon: <ChevronUp size={14} />, disabled: activeLayerIndex >= layers.length - 1, action: () => moveLayerBy(activeLayerId, 1) },
    { label: 'Опустить слой', icon: <ChevronDown size={14} />, disabled: activeLayerIndex <= 0, action: () => moveLayerBy(activeLayerId, -1) },
    { separator: true },
    { label: activeLayer?.visible ? 'Скрыть слой' : 'Показать слой', checked: activeLayer?.visible, action: () => toggleLayerVisibility(activeLayerId) },
    { label: 'Удалить слой', danger: true, icon: <Trash2 size={14} />, disabled: layers.length < 2, action: () => deleteLayer(activeLayerId) },
  ]
  const toolsMenu: ContextMenuItem[] = [
    ...tools.map((item) => ({ label: item.label, shortcut: shortcuts[item.shortcut], checked: tool === item.id, action: () => chooseTool(item.id) })),
    { separator: true },
    { label: 'Рисовать по 3D-модели', checked: paintOn3d, action: () => setPaintOn3d((value) => !value) },
    { label: 'Присяд + раскрытие элитр', shortcut: 'Shift', checked: crouching, action: () => setCrouchPinned((value) => !value) },
    { label: 'Автовращение модели', checked: autoRotate, action: () => setAutoRotate((value) => !value) },
  ]
  const settingsMenu: ContextMenuItem[] = [
    { label: 'Настроить горячие клавиши…', icon: <Keyboard size={14} />, action: () => setShowShortcuts(true) },
    { label: 'Сбросить скин модели', icon: <RotateCw size={14} />, disabled: !skinUrl, action: () => { setSkinUrl(null); setSkinFilename(''); setStatus('Возвращён стандартный скин модели') } },
  ]
  const appContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    // Keep the native text-editing menu for fields so right-click paste/copy still works.
    const target = event.target
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"], .classic-context-menu')) return
    openContextMenu(event, [
      ...editMenu,
      { separator: true },
      ...layerMenu,
      { separator: true },
      ...fileMenu,
      { separator: true },
      ...viewMenu,
      { separator: true },
      ...toolsMenu,
      { separator: true },
      { label: 'Справка и горячие клавиши', icon: <CircleHelp size={14} />, action: () => setHelpOpen(true) },
    ])
  }

  return (
    <div className="app-shell" onContextMenu={appContextMenu}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Layers3 size={19} /></div>
          <div className="brand-text"><strong>Minecraft <span>Texture Studio</span></strong><small>PIXEL TEXTURE EDITOR</small></div>
        </div>
        <div className="document-title">
          <FileImage size={15} />
          <input aria-label="Имя файла" value={filename} onChange={(event) => setFilename(event.target.value)} />
          {dirty && <span className="dirty-dot" title="Есть несохранённые изменения" />}
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/*" onChange={handleImport} hidden />
        <input ref={projectInputRef} type="file" accept=".mts,.json,application/json" onChange={handleOpenProjectFile} hidden />
        <input ref={skinInputRef} type="file" accept="image/png" onChange={handleImportSkin} hidden />
      </header>

      <nav className="classic-menu-bar" aria-label="Главное меню">
        <button onClick={(event) => openContextMenu(event, fileMenu)}>Файл</button>
        <button onClick={(event) => openContextMenu(event, editMenu)}>Правка</button>
        <button onClick={(event) => openContextMenu(event, viewMenu)}>Вид</button>
        <button onClick={(event) => openContextMenu(event, [
          { label: 'Импортировать текстуру…', icon: <FileImage size={14} />, action: openFile },
          { label: 'Импортировать как новый слой…', icon: <Layers3 size={14} />, action: openImportAsNewLayer },
          { label: 'Экспортировать PNG…', icon: <Download size={14} />, action: exportPng },
          { separator: true },
          { label: 'Показать UV-шаблон', checked: showUv, action: () => setShowUv((value) => !value) },
          { label: 'Показать пиксельную сетку', checked: showGrid, action: () => setShowGrid((value) => !value) },
        ])}>Изображение</button>
        <button onClick={(event) => openContextMenu(event, layerMenu)}>Слой</button>
        <button onClick={(event) => openContextMenu(event, toolsMenu)}>Инструменты</button>
        <button onClick={(event) => openContextMenu(event, settingsMenu)}>Настройки</button>
        <button onClick={(event) => openContextMenu(event, [{ label: 'Быстрый старт', action: () => setHelpOpen(true) }, { label: 'О версии и проекте', disabled: true }])}>Справка</button>
      </nav>

      {helpOpen && <div className="help-popover"><strong>Быстрый старт</strong><p>Выбери инструмент и цвет, затем рисуй на развёртке или прямо по модели. Выделение ограничивает кисть, заливку и примитивы; внутри выделения можно двигать пиксели, тянуть за маркеры и поворачивать кнопками в шапке холста. Точная настройка цвета — кнопка с ползунками рядом с HEX. Слои — в левой панели под палитрой.</p></div>}

      <div className="workspace-toolbar">
        <div className="toolbar-center">
          <button className="toolbar-action" onClick={undo} disabled={!history.length} title="Отменить"><Undo2 size={15} /></button>
          <button className="toolbar-action" onClick={redo} disabled={!future.length} title="Повторить"><Redo2 size={15} /></button>
          <span className="toolbar-divider" />
          <button className={`toolbar-action ${activeGridVisible ? 'toolbar-action-active' : ''}`} onClick={toggleActiveGrid} title={`${activeGridTitle} (${shortcuts.toggleGrid})`} aria-label={activeGridTitle}><Grid2X2 size={15} /></button>
          <button className={`toolbar-action ${showUv ? 'toolbar-action-active' : ''}`} onClick={() => setShowUv((value) => !value)} title={`UV-шаблон (${shortcuts.toggleUv})`}><Eye size={15} /></button>
          <span className="toolbar-divider" />
          <span className="zoom-label">МАСШТАБ</span>
          <button className="toolbar-action zoom-step" onClick={() => setZoom((value) => Math.max(2, Math.round(value / 1.2)))} title="Уменьшить масштаб"><ZoomOut size={14} /></button>
          <span className="zoom-value">{zoom * 100}%</span>
          <button className="toolbar-action zoom-step" onClick={() => setZoom((value) => Math.min(2048, Math.round(value * 1.2)))} title="Увеличить масштаб"><ZoomIn size={14} /></button>
        </div>
        <div className="view-switcher" role="group" aria-label="Режим отображения">
          <button onClick={() => switchView('2d')} className={viewMode === '2d' ? 'view-option active' : 'view-option'}><PanelsTopLeft size={14} /> 2D</button>
          <button onClick={() => switchView('split')} className={viewMode === 'split' ? 'view-option active' : 'view-option'}><Maximize2 size={14} /> Split</button>
          <button onClick={() => switchView('3d')} className={viewMode === '3d' ? 'view-option active' : 'view-option'}><Box size={14} /> 3D</button>
        </div>
      </div>

      <main className={`main-layout mode-${viewMode}`}>
        <aside className="left-sidebar">
          <PalettePanel
            currentColor={currentColor}
            secondaryColor={secondaryColor}
            activeColorSlot={activeColorSlot}
            onSelectColor={selectPaletteColor}
            onSelectSlot={setActiveColorSlot}
            onNotice={setStatus}
          />
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onSelect={selectLayer}
            onToggleVisibility={toggleLayerVisibility}
            onAdd={addLayer}
            onDuplicate={duplicateLayer}
            onDelete={deleteLayer}
            onMove={moveLayerBy}
            onMergeDown={mergeDown}
            onRename={renameLayer}
            onOpacityStart={beginOpacityEdit}
            onOpacityChange={setLayerOpacity}
            onOpacityEnd={endOpacityEdit}
          />
        </aside>

        <section className={`editor-area ${viewMode === '3d' ? 'editor-area-hidden' : ''}`}>
          <div className="panel-topline"><div className="panel-title"><span className="panel-title-dot" /> <span>ТЕКСТУРА</span><span className="panel-subtitle">/ UV ATLAS</span></div><div className="panel-tools">
            <span className="active-tool-indicator"><MousePointer2 size={13} /> {activeToolLabel}</span>
            {tool === 'select' && displaySelection && (
              <span className="transform-bar" role="group" aria-label="Трансформация выделения">
                <button className="toolbar-action tiny-action" onClick={() => transformSelection('rotateCCW')} title="Повернуть на 90° против часовой"><RotateCcw size={13} /></button>
                <button className="toolbar-action tiny-action" onClick={() => transformSelection('rotateCW')} title="Повернуть на 90° по часовой"><RotateCw size={13} /></button>
                <button className="toolbar-action tiny-action" onClick={() => transformSelection('rotate180')} title="Повернуть на 180°"><RefreshCw size={13} /></button>
                <button className="toolbar-action tiny-action" onClick={() => transformSelection('flipH')} title="Отразить по горизонтали"><FlipHorizontal size={13} /></button>
                <button className="toolbar-action tiny-action" onClick={() => transformSelection('flipV')} title="Отразить по вертикали"><FlipVertical size={13} /></button>
              </span>
            )}
            {displaySelection && <><span className="panel-separator" /><span className="selection-readout">SEL {rectWidth(displaySelection)}×{rectHeight(displaySelection)}</span></>}
            <span className="panel-separator" /><span className="cursor-readout">X {String(cursorPos[0]).padStart(2, '0')} · Y {String(cursorPos[1]).padStart(2, '0')}</span>
          </div></div>
          <TextureCanvas
            pixels={displayPixels}
            tool={tool}
            color={currentColor}
            secondaryColor={secondaryColor}
            zoom={zoom}
            showGrid={showGrid}
            showUv={showUv}
            shortcuts={shortcuts}
            selection={selection}
            selectionActions={selectionActions}
            transformRect={floating ? { x0: floating.x, y0: floating.y, x1: floating.x + floating.width - 1, y1: floating.y + floating.height - 1 } : null}
            onTransformStart={beginSelectionTransform}
            onTransformUpdate={updateSelectionTransform}
            onTransformCommit={commitSelectionTransform}
            onTransformCancel={cancelSelectionTransform}
            onZoomChange={setZoom}
            onPaintLine={paint}
            onFill={fill}
            onStrokeStart={beginStroke}
            onStrokeEnd={endStroke}
            onDrawShape={drawShape}
            onSelectionChange={handleSelectionChange}
            onPick={handlePickColor}
            onCursor={(x, y) => setCursorPos([x, y])}
            onUndo={undo}
            onRedo={redo}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
            onToggleGrid={() => setShowGrid((value) => !value)}
            onToggleUv={() => setShowUv((value) => !value)}
            onZoomReset={() => setZoom(10)}
            onSetTool={chooseTool}
            onImportTexture={openFile}
            onExportTexture={exportPng}
            onClearTexture={resetTexture}
          />
          <footer className="editor-status"><span><span className="status-led" /> {status}</span><span>{layers.length} сл. · PNG · RGBA · nearest-neighbor</span></footer>
        </section>

        <section className={`preview-area ${viewMode === '2d' ? 'preview-area-hidden' : ''}`} onContextMenu={(event) => openContextMenu(event, [
          { label: paintOn3d ? 'Отключить рисование по модели' : 'Рисовать по модели', checked: paintOn3d, action: () => setPaintOn3d((value) => !value) },
          { label: show3dGrid ? 'Скрыть сетку на модели' : 'Показать сетку на модели', checked: show3dGrid, action: () => setShow3dGrid((value) => !value) },
          { label: showModelBounds ? 'Скрыть границы модели' : 'Показать границы модели', checked: showModelBounds, action: () => setShowModelBounds((value) => !value) },
          { separator: true },
          { label: crouching ? 'Убрать присяд' : 'Присяд и раскрытие элитр', shortcut: 'Shift', checked: crouching, action: () => setCrouchPinned((value) => !value) },
          { label: autoRotate ? 'Остановить вращение' : 'Автовращение', checked: autoRotate, action: () => setAutoRotate((value) => !value) },
        ])}>
          <div className="panel-topline"><div className="panel-title"><span className="panel-title-dot blue-dot" /> <span>ПРЕДПРОСМОТР</span><span className="panel-subtitle">/ 3D EDIT</span></div><div className="panel-tools preview-tools">
            <button className={`toolbar-action tiny-action ${paintOn3d ? 'toolbar-action-active' : ''}`} onClick={() => setPaintOn3d((value) => !value)} title="Рисовать прямо по элитрам"><Paintbrush size={14} /></button>
            <button className={`toolbar-action tiny-action ${show3dGrid ? 'toolbar-action-active' : ''}`} onClick={() => setShow3dGrid((value) => !value)} title="Тонкая сетка пикселей на модели"><Grid2X2 size={14} /></button>
            <button className={`toolbar-action tiny-action ${showModelBounds ? 'toolbar-action-active' : ''}`} onClick={() => setShowModelBounds((value) => !value)} title="Границы геометрии модели"><ScanLine size={14} /></button>
            <button className={`toolbar-action tiny-action ${crouching ? 'toolbar-action-active' : ''}`} onClick={() => setCrouchPinned((value) => !value)} title="Присяд + раскрытие элитр (Shift)"><PersonStanding size={14} /></button>
            <button className={`toolbar-action tiny-action ${autoRotate ? 'toolbar-action-active' : ''}`} onClick={() => setAutoRotate((value) => !value)} title="Автовращение"><RotateCw size={14} /></button>
            <span className="live-label"><span className="live-dot" /> LIVE</span>
          </div></div>
          <ElytraViewer pixels={displayPixels} visible={viewMode !== '2d'} autoRotate={autoRotate} skinUrl={skinUrl} tool={tool} color={currentColor} secondaryColor={secondaryColor} showGrid={show3dGrid} showBounds={showModelBounds} paintEnabled={paintOn3d} crouching={crouching} onPaintLine={paint} onFill={fill} onStrokeStart={beginStroke} onStrokeEnd={endStroke} onPick={handlePickColor} onNotice={setStatus} onTogglePaint={() => setPaintOn3d((value) => !value)} onToggleGrid={() => setShow3dGrid((value) => !value)} onToggleBounds={() => setShowModelBounds((value) => !value)} onToggleCrouch={() => setCrouchPinned((value) => !value)} onToggleAutoRotate={() => setAutoRotate((value) => !value)} />
        </section>

        <aside className="right-tools">
          <div className="tool-stack">
            {tools.map((item) => {
              const Icon = item.icon
              return (
                <Fragment key={item.id}>
                  <button className={`tool-button ${tool === item.id ? 'tool-active' : ''}`} onClick={() => chooseTool(item.id)} onContextMenu={(event) => openContextMenu(event, [
                    { label: `Выбрать: ${item.label}`, checked: tool === item.id, action: () => chooseTool(item.id) },
                  ])} title={`${item.label} (${shortcuts[item.shortcut]})`} aria-label={item.label}><Icon size={19} /><kbd>{shortcuts[item.shortcut].replace('Ctrl+', '⌃')}</kbd></button>
                  {item.separatorAfter && <div className="tool-separator" />}
                </Fragment>
              )
            })}
          </div>
          <button className="tool-button swap-colors-button" onClick={swapColors} title={`Поменять основной и фоновый цвета (${shortcuts.swapColors})`}><ArrowLeftRight size={17} /><kbd>{shortcuts.swapColors}</kbd></button>
          <button className="tool-button" onClick={resetTexture} title="Новая пустая текстура"><Sparkles size={18} /></button>
          <div className="toolbar-spacer" />
          <div className="tool-color-stack" title="Основной и фоновый цвета"><button className="foreground-color" style={{ background: currentColor }} onClick={() => setActiveColorSlot('foreground')} onContextMenu={(event) => openContextMenu(event, [
            { label: 'Использовать как основной цвет', checked: activeColorSlot === 'foreground', action: () => setActiveColorSlot('foreground') },
            { label: 'Поменять FG / BG', shortcut: shortcuts.swapColors, action: swapColors },
          ])} aria-label="Выбрать основной цвет" /><button className="background-color" style={{ background: secondaryColor }} onClick={() => setActiveColorSlot('background')} onContextMenu={(event) => openContextMenu(event, [
            { label: 'Использовать как фоновый цвет', checked: activeColorSlot === 'background', action: () => setActiveColorSlot('background') },
            { label: 'Поменять FG / BG', shortcut: shortcuts.swapColors, action: swapColors },
          ])} aria-label="Выбрать фоновый цвет" /></div>
        </aside>
      </main>
      {showShortcuts && <ShortcutsModal shortcuts={shortcuts} onChange={setBinding} onClose={() => setShowShortcuts(false)} onReset={() => { setShortcuts(defaultShortcuts); localStorage.removeItem('mts-shortcuts-v1') }} />}
    </div>
  )
}
