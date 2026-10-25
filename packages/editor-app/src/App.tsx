import React from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ComponentType, MouseEvent as ReactMouseEvent } from 'react'
import {
  Brush, Eraser, PaintBucket, Pipette,
  Eye, Grid2X2, Keyboard, RotateCw, PanelsTopLeft, Box, ChevronDown, ChevronUp,
  FileImage, CircleHelp, Maximize2, Layers3, Sparkles, MousePointer2, ZoomIn, ZoomOut, UserRound,
  Paintbrush, ScanLine, PersonStanding,
  SquareDashedMousePointer, Slash, Square, Circle, Merge, Plus,
  FlipHorizontal, FlipVertical, RefreshCw, RotateCcw, X,
} from 'lucide-react'
import TextureCanvas from '@rawsprite/editor-ui/TextureCanvas'
import PalettePanel from '@rawsprite/editor-ui/PalettePanel'
import LayersPanel from '@rawsprite/editor-ui/LayersPanel'
import ShortcutsModal, { defaultShortcuts, normalizeShortcuts } from '@rawsprite/editor-ui/ShortcutsModal'
import ConfirmDialog from '@rawsprite/editor-ui/ConfirmDialog'
import NewDocumentDialog from '@rawsprite/editor-ui/NewDocumentDialog'
import XpIcon from '@rawsprite/editor-ui/XpIcon'
import { useContextMenu } from '@rawsprite/editor-ui/ContextMenu'
import type { ContextMenuItem } from '@rawsprite/editor-ui/ContextMenu'
import type { ShortcutId, ShortcutMap } from '@rawsprite/editor-ui/ShortcutsModal'
import { transparentPixel } from '@rawsprite/core/palettes'
import { defaultElytraPixels } from '@rawsprite/plugin-minecraft/defaultElytra'
import {
  clearRegion, copyRegion, floodFill, paintPoints, pasteRegion, pixelsToPngBlob, placePixels, readImageFile,
} from '@rawsprite/core/texture'
import type { PixelRegion } from '@rawsprite/core/texture'
import {
  cloneLayer, compositeLayers, createLayer, createLayerId, emptyLayerPixels, layersFromPixels, mergeLayerPixels,
  moveLayer as moveLayerInStack, nextLayerName,
} from '@rawsprite/core/layers'
import type { Layer } from '@rawsprite/core/layers'
import { isPixelArray, parseProjectLayers } from '@rawsprite/core/project'
import { applyTransform, blitBlock, blockSelection, extractBlock, scaleBlock } from '@rawsprite/core/transform'
import type { PixelBlock, TransformKind, TransformRect } from '@rawsprite/core/transform'
import { linePoints, rectHeight, rectWidth, shapePoints } from '@rawsprite/core/shapes'
import type { SelectionRect, Shape } from '@rawsprite/core/shapes'
import { shortcutKey } from '@rawsprite/core/shortcutKey'
import {
  basename, ensureExtension, isDesktopRuntime, pickOpenPath, pickSavePath, readTextFile,
  saveBlobInBrowser, toPngName, toProjectName, writeBinaryFile, writeTextFile,
} from '@rawsprite/editor-ui/files'
import type { BrowserFileHandle } from '@rawsprite/editor-ui/files'

import type { ToolId } from '@rawsprite/editor-ui/types'
export type { ToolId } from '@rawsprite/editor-ui/types'
type ViewMode = '2d' | 'split' | '3d'
type AppMode = 'rawsprite' | 'minecraft'
/** The Minecraft app injects ElytraViewer; the base app passes no preview at all. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PreviewComponent = ComponentType<any>
type AppProps = { mode?: AppMode; previewComponent?: PreviewComponent | null }

type Snapshot = { layers: Layer[]; activeLayerId: string }

type DocumentState = {
  id: string
  filename: string
  width: number
  height: number
  dirty: boolean
  layers: Layer[]
  activeLayerId: string
  history: Snapshot[]
  future: Snapshot[]
  selection: SelectionRect | null
  skinUrl: string | null
  skinFilename: string
  zoom: number
  projectPath: string | null
}

function createDocument(filename: string, layers?: Layer[], overrides: Partial<DocumentState> = {}): DocumentState {
  const width = overrides.width ?? 64
  const height = overrides.height ?? 32
  const initialLayers = layers && layers.length > 0 ? layers : [createLayer('Слой 1', undefined, width, height)]
  return {
    id: createLayerId(),
    filename,
    width,
    height,
    dirty: false,
    layers: initialLayers,
    activeLayerId: initialLayers[initialLayers.length - 1].id,
    history: [],
    future: [],
    selection: null,
    skinUrl: null,
    skinFilename: '',
    zoom: 10,
    projectPath: null,
    ...overrides,
  }
}

function createDefaultDocument(filename: string): DocumentState {
  return createDocument(filename, [createLayer('Слой 1', [...defaultElytraPixels], 64, 32)], { width: 64, height: 32 })
}

function createBlankDocument(filename: string, width: number, height: number): DocumentState {
  const safeWidth = Math.max(1, Math.min(2048, Math.round(width)))
  const safeHeight = Math.max(1, Math.min(2048, Math.round(height)))
  const zoom = Math.max(0.05, Math.min(16, Math.min(960 / safeWidth, 720 / safeHeight)))
  return createDocument(
    filename,
    [createLayer('Слой 1', undefined, safeWidth, safeHeight)],
    { width: safeWidth, height: safeHeight, zoom },
  )
}

function nextUntitledName(documents: DocumentState[], extension = 'mts'): string {
  const names = new Set(documents.map((document) => document.filename))
  let index = 1
  while (names.has(`Без названия ${index}.${extension}`)) index += 1
  return `Без названия ${index}.${extension}`
}

function resolveValue<T>(value: T | ((previous: T) => T), previous: T): T {
  return typeof value === 'function' ? (value as (previous: T) => T)(previous) : value
}

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
  version: 3
  filename: string
  width: number
  height: number
  activeLayerId: string
  layers: ProjectLayerData[]
  selection?: SelectionRect | null
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

function readProjectSelection(value: unknown, width: number, height: number): SelectionRect | null {
  if (typeof value !== 'object' || value === null) return null
  const rect = value as { x0?: unknown; y0?: unknown; x1?: unknown; y1?: unknown }
  if (![rect.x0, rect.y0, rect.x1, rect.y1].every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))) return null
  const x0 = Math.max(0, Math.min(width - 1, Math.round(rect.x0 as number)))
  const y0 = Math.max(0, Math.min(height - 1, Math.round(rect.y0 as number)))
  const x1 = Math.max(0, Math.min(width - 1, Math.round(rect.x1 as number)))
  const y1 = Math.max(0, Math.min(height - 1, Math.round(rect.y1 as number)))
  return x1 >= x0 && y1 >= y0 ? { x0, y0, x1, y1 } : null
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
  const key = shortcutKey(event)
  const parts = shortcut.split('+')
  const targetKey = parts[parts.length - 1]
  const wantsCtrl = parts.includes('Ctrl')
  const wantsAlt = parts.includes('Alt')
  const wantsShift = parts.includes('Shift')
  return key === targetKey && Boolean(event.ctrlKey || event.metaKey) === wantsCtrl && event.altKey === wantsAlt && event.shiftKey === wantsShift
}

export default function App({ mode = 'minecraft', previewComponent: Preview = null }: AppProps = {}) {
  const { openContextMenu } = useContextMenu()
  const previewAvailable = mode === 'minecraft' && Preview !== null
  const projectExtension = mode === 'rawsprite' ? 'rsp' : 'mts'
  const projectLabel = mode === 'rawsprite' ? 'RawSprite project' : 'Minecraft Texture Studio project'
  const projectMime = mode === 'rawsprite' ? 'application/x-rawsprite-project' : 'application/x-minecraft-texture-studio'
  const [documents, setDocuments] = useState<DocumentState[]>(() => [mode === 'rawsprite'
    ? createBlankDocument('Без названия 1.rsp', 64, 64)
    : createDefaultDocument('elytra.png')])
  const [activeDocumentId, setActiveDocumentId] = useState(() => documents[0].id)
  const [newDocumentOpen, setNewDocumentOpen] = useState(false)
  const [pendingClose, setPendingClose] = useState<{ id: string; filename: string } | null>(null)
  const browserProjectHandlesRef = useRef(new Map<string, BrowserFileHandle>())
  const documentsRef = useRef(documents)
  const activeDocRef = useRef(activeDocumentId)
  const layersRef = useRef(documents[0].layers)
  const activeLayerIdRef = useRef(documents[0].activeLayerId)
  const historyRef = useRef<Snapshot[]>(documents[0].history)
  const futureRef = useRef<Snapshot[]>(documents[0].future)
  const [clipboard, setClipboard] = useState<PixelRegion | null>(null)
  const [floating, setFloating] = useState<FloatingTransform | null>(null)
  const transformSnapshotRef = useRef<Snapshot | null>(null)

  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0]
  const { layers, width, height, activeLayerId, selection, filename, dirty, skinUrl, skinFilename, zoom, history, future, projectPath } = activeDocument
  // Large canvases cannot afford 80 full snapshots; keep undo useful without exhausting memory.
  const historyLimit = useMemo(() => Math.max(1, Math.min(80, Math.floor(4_000_000 / Math.max(1, width * height)))), [width, height])

  const writeActiveDocument = useCallback((updater: (document: DocumentState) => DocumentState) => {
    const current = documentsRef.current
    const index = current.findIndex((document) => document.id === activeDocRef.current)
    if (index < 0) return
    const next = [...current]
    next[index] = updater(current[index])
    documentsRef.current = next
    setDocuments(next)
  }, [])

  const setLayers = useCallback((value: Layer[] | ((previous: Layer[]) => Layer[])) => {
    writeActiveDocument((document) => {
      const nextLayers = resolveValue(value, document.layers)
      layersRef.current = nextLayers
      return { ...document, layers: nextLayers }
    })
  }, [writeActiveDocument])

  const setActiveLayerId = useCallback((value: string | ((previous: string) => string)) => {
    writeActiveDocument((document) => {
      const nextId = resolveValue(value, document.activeLayerId)
      activeLayerIdRef.current = nextId
      return { ...document, activeLayerId: nextId }
    })
  }, [writeActiveDocument])

  const setHistory = useCallback((value: Snapshot[] | ((previous: Snapshot[]) => Snapshot[])) => {
    writeActiveDocument((document) => {
      const nextHistory = resolveValue(value, document.history)
      historyRef.current = nextHistory
      return { ...document, history: nextHistory }
    })
  }, [writeActiveDocument])

  const setFuture = useCallback((value: Snapshot[] | ((previous: Snapshot[]) => Snapshot[])) => {
    writeActiveDocument((document) => {
      const nextFuture = resolveValue(value, document.future)
      futureRef.current = nextFuture
      return { ...document, future: nextFuture }
    })
  }, [writeActiveDocument])

  const setSelection = useCallback((value: SelectionRect | null) => {
    writeActiveDocument((document) => ({ ...document, selection: value }))
  }, [writeActiveDocument])

  const setFilename = useCallback((value: string) => {
    writeActiveDocument((document) => ({ ...document, filename: value }))
  }, [writeActiveDocument])

  const setDirty = useCallback((value: boolean) => {
    writeActiveDocument((document) => ({ ...document, dirty: value }))
  }, [writeActiveDocument])

  const setSkinUrl = useCallback((value: string | null) => {
    writeActiveDocument((document) => ({ ...document, skinUrl: value }))
  }, [writeActiveDocument])

  const setSkinFilename = useCallback((value: string) => {
    writeActiveDocument((document) => ({ ...document, skinFilename: value }))
  }, [writeActiveDocument])

  const setZoom = useCallback((value: number | ((previous: number) => number)) => {
    writeActiveDocument((document) => ({ ...document, zoom: resolveValue(value, document.zoom) }))
  }, [writeActiveDocument])

  const setProjectPath = useCallback((value: string | null) => {
    writeActiveDocument((document) => ({ ...document, projectPath: value }))
  }, [writeActiveDocument])
  const [currentColor, setCurrentColor] = useState('#4ba3ff')
  const [tool, setTool] = useState<ToolId>('brush')
  const previousToolRef = useRef<ToolId>('brush')
  const [viewMode, setViewMode] = useState<ViewMode>(previewAvailable ? 'split' : '2d')
  const [showGrid, setShowGrid] = useState(true)
  const [showUv, setShowUv] = useState(previewAvailable)
  const [show3dGrid, setShow3dGrid] = useState(false)
  const [showModelBounds, setShowModelBounds] = useState(false)
  const [paintOn3d, setPaintOn3d] = useState(true)
  const [crouchPinned, setCrouchPinned] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const crouching = crouchPinned || shiftHeld
  const [autoRotate, setAutoRotate] = useState(false)
  const [cursorPos, setCursorPos] = useState<[number, number]>([0, 0])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
    try {
      const saved = localStorage.getItem('mts-shortcuts-v1')
      if (!saved) return defaultShortcuts
      const parsed = JSON.parse(saved) as Partial<ShortcutMap>
      if (parsed.export === 'Ctrl+S') parsed.export = 'Ctrl+Shift+E'
      return normalizeShortcuts(parsed)
    } catch { return defaultShortcuts }
  })
  const pendingHistoryRef = useRef<Snapshot | null>(null)
  // A brush stroke is many pointermove commits but a single undo step. The first
  // changed pixel of a stroke pushes the snapshot; the rest only update pixels.
  const strokeActiveRef = useRef(false)
  const strokeSnapshotPushedRef = useRef(false)
  const importModeRef = useRef<'active' | 'new'>('active')
  const [status, setStatus] = useState('Готово к рисованию')
  const [helpOpen, setHelpOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const skinInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!previewAvailable && viewMode !== '2d') setViewMode('2d')
  }, [previewAvailable, viewMode])

  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { activeLayerIdRef.current = activeLayerId }, [activeLayerId])
  useEffect(() => { documentsRef.current = documents }, [documents])
  useEffect(() => { activeDocRef.current = activeDocumentId }, [activeDocumentId])

  // The canvas, the 3D preview and PNG export all show the flattened stack.
  const pixels = useMemo(() => compositeLayers(layers, width, height), [layers, width, height])
  // While a selection is being moved/resized, the active layer already has the source
  // area cleared; draw the floating pixels on top for a live preview.
  const displayPixels = useMemo(() => {
    if (!floating) return pixels
    const scaled = floating.width === floating.block.width && floating.height === floating.block.height
      ? floating.block
      : scaleBlock(floating.block, floating.width, floating.height)
    return blitBlock(pixels, scaled, floating.x, floating.y, width, height)
  }, [pixels, floating, width, height])
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[layers.length - 1]
  const activeLayerIndex = layers.findIndex((layer) => layer.id === activeLayerId)
  const displaySelection: SelectionRect | null = floating
    ? { x0: floating.x, y0: floating.y, x1: floating.x + floating.width - 1, y1: floating.y + floating.height - 1 }
    : selection

  useEffect(() => {
    document.title = mode === 'rawsprite'
      ? `${dirty ? '• ' : ''}RawSprite — ${filename || 'Без названия.rsp'}`
      : `${dirty ? '• ' : ''}Minecraft Texture Studio — ${filename || 'elytra.png'}`
  }, [dirty, filename])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!documents.some((document) => document.dirty)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [documents])

  const currentSnapshot = useCallback((): Snapshot => ({ layers: layersRef.current, activeLayerId: activeLayerIdRef.current }), [])

  const pushHistory = useCallback(() => {
    const nextHistory = historyLimit <= 1
      ? [currentSnapshot()]
      : [...historyRef.current.slice(-(historyLimit - 1)), currentSnapshot()]
    historyRef.current = nextHistory
    setHistory(nextHistory)
    futureRef.current = []
    setFuture([])
  }, [currentSnapshot, historyLimit])

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
  }, [applyLayers, pushHistory, width, height, historyLimit])

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
    const nextFuture = [currentSnapshot(), ...futureRef.current].slice(0, historyLimit)
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
  }, [currentSnapshot, endStroke, historyLimit])

  const redo = useCallback(() => {
    const list = futureRef.current
    if (!list.length) return
    endStroke()
    const target = list[0]
    const nextHistory = [...historyRef.current, currentSnapshot()].slice(-historyLimit)
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
  }, [currentSnapshot, endStroke, historyLimit])

  // ----- drawing -----------------------------------------------------------

  const paint = useCallback((x0: number, y0: number, x1: number, y1: number, color: string) => {
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(paintPoints(getActivePixels(), linePoints(x0, y0, x1, y1), color, selection, width, height), color === transparentPixel ? 'Ластик' : 'Рисование')
  }, [commitLayerPixels, getActivePixels, requireEditableActiveLayer, selection, width, height])

  const fill = useCallback((x: number, y: number, fillColor = currentColor) => {
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(floodFill(getActivePixels(), x, y, fillColor, selection, width, height), 'Заливка области')
  }, [commitLayerPixels, currentColor, getActivePixels, requireEditableActiveLayer, selection, width, height])

  const drawShape = useCallback((shape: Shape, shapeColor: string) => {
    if (!requireEditableActiveLayer()) return
    const label = shape.kind === 'line' ? 'Линия' : shape.kind === 'rect' ? 'Прямоугольник' : 'Эллипс'
    commitLayerPixels(paintPoints(getActivePixels(), shapePoints(shape), shapeColor, selection, width, height), label)
  }, [commitLayerPixels, getActivePixels, requireEditableActiveLayer, selection, width, height])

  const handleSelectionChange = useCallback((next: SelectionRect | null) => {
    setSelection(next)
    setStatus(next ? `Выделение ${rectWidth(next)}×${rectHeight(next)}` : 'Выделение снято')
  }, [])

  // ----- clipboard ---------------------------------------------------------

  const effectiveSelection = useCallback((): SelectionRect => selection ?? { x0: 0, y0: 0, x1: width - 1, y1: height - 1 }, [selection, width, height])

  const copySelection = useCallback(() => {
    const region = copyRegion(getActivePixels(), effectiveSelection(), width, height)
    if (!region) return
    setClipboard(region)
    setStatus(`Скопировано ${region.width}×${region.height}`)
  }, [effectiveSelection, getActivePixels, width, height])

  // Copies what the artist actually sees: the flattened visible stack, not just the
  // active layer. Essential when shading and highlights live on separate layers.
  const copyMerged = useCallback(() => {
    const region = copyRegion(pixels, effectiveSelection(), width, height)
    if (!region) return
    setClipboard(region)
    setStatus(`Скопировано объединённое ${region.width}×${region.height}`)
  }, [effectiveSelection, pixels, width, height])

  const cutSelection = useCallback(() => {
    const region = copyRegion(getActivePixels(), effectiveSelection(), width, height)
    if (!region) return
    setClipboard(region)
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(clearRegion(getActivePixels(), effectiveSelection(), width, height), 'Вырезано в буфер')
  }, [commitLayerPixels, effectiveSelection, getActivePixels, requireEditableActiveLayer, width, height])

  const pasteClipboard = useCallback(() => {
    if (!clipboard) { setStatus('Внутренний буфер пуст'); return }
    if (!requireEditableActiveLayer()) return
    const originX = selection ? selection.x0 : 0
    const originY = selection ? selection.y0 : 0
    commitLayerPixels(pasteRegion(getActivePixels(), clipboard, originX, originY, null, width, height), 'Вставка из буфера')
    setSelection({
      x0: originX,
      y0: originY,
      x1: Math.min(width - 1, originX + clipboard.width - 1),
      y1: Math.min(height - 1, originY + clipboard.height - 1),
    })
  }, [clipboard, commitLayerPixels, getActivePixels, requireEditableActiveLayer, selection, width, height])

  const pasteClipboardAsNewLayer = useCallback(() => {
    if (!clipboard) { setStatus('Внутренний буфер пуст'); return }
    const originX = selection ? selection.x0 : 0
    const originY = selection ? selection.y0 : 0
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    pushHistory()
    const layer = createLayer('Вставка', emptyLayerPixels(width, height), width, height)
    layer.pixels = pasteRegion(layer.pixels, clipboard, originX, originY, null, width, height)
    const insertAt = index < 0 ? current.length : index + 1
    applyLayers([...current.slice(0, insertAt), layer, ...current.slice(insertAt)], 'Вставлено в новый слой', layer.id)
    setSelection({
      x0: originX,
      y0: originY,
      x1: Math.min(width - 1, originX + clipboard.width - 1),
      y1: Math.min(height - 1, originY + clipboard.height - 1),
    })
  }, [applyLayers, clipboard, pushHistory, selection, width, height])

  const deleteSelection = useCallback(() => {
    if (!requireEditableActiveLayer()) return
    commitLayerPixels(clearRegion(getActivePixels(), effectiveSelection(), width, height), 'Выделение очищено')
  }, [commitLayerPixels, effectiveSelection, getActivePixels, requireEditableActiveLayer, width, height])

  const selectAll = useCallback(() => {
    setSelection({ x0: 0, y0: 0, x1: width - 1, y1: height - 1 })
    setStatus('Выделен весь холст')
  }, [width, height])

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
    const block = extractBlock(getActivePixels(), source, width)
    const index = layersRef.current.findIndex((layer) => layer.id === activeLayerIdRef.current)
    if (index < 0) return false
    transformSnapshotRef.current = currentSnapshot()
    const cleared = clearRegion(getActivePixels(), source, width, height)
    // Apply the cleared layer without touching history: the whole transform becomes
    // one undo step when it is committed.
    const next = layersRef.current.map((layer, layerIndex) => layerIndex === index ? { ...layer, pixels: cleared } : layer)
    layersRef.current = next
    setLayers(next)
    setFloating({ block, source, x: source.x0, y: source.y0, width: block.width, height: block.height })
    setStatus('Трансформация: тяни внутри, тяни за маркеры, поворот — кнопками сверху')
    return true
  }, [currentSnapshot, floating, getActivePixels, requireEditableActiveLayer, selection, width, height])

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
    const baked = blitBlock(getActivePixels(), scaled, rect.x, rect.y, width, height)
    const snapshot = transformSnapshotRef.current
    const snapshotPixels = snapshot?.layers.find((layer) => layer.id === snapshot.activeLayerId)?.pixels
    if (!snapshot || (snapshotPixels && pixelsEqual(baked, snapshotPixels))) {
      // A click or a drag that ended where it started must not pollute the history.
      restoreTransformSnapshot()
      setStatus(`Выделение ${rect.width}×${rect.height}`)
      return
    }
    const nextHistory = historyLimit <= 1 ? [snapshot] : [...historyRef.current.slice(-(historyLimit - 1)), snapshot]
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
  }, [applyLayers, floating, getActivePixels, restoreTransformSnapshot, width, height, historyLimit])

  const transformSelection = useCallback((kind: TransformKind) => {
    if (!selection) { setStatus('Сначала выдели область'); return }
    if (!requireEditableActiveLayer()) return
    const source = selection
    const block = extractBlock(getActivePixels(), source, width)
    const nextBlock = applyTransform(block, kind)
    const x = source.x0 + Math.floor((block.width - nextBlock.width) / 2)
    const y = source.y0 + Math.floor((block.height - nextBlock.height) / 2)
    const cleared = clearRegion(getActivePixels(), source, width, height)
    const baked = blitBlock(cleared, nextBlock, x, y, width, height)
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

  // ----- documents / tabs --------------------------------------------------

  const activateDocument = useCallback((id: string) => {
    const target = documentsRef.current.find((document) => document.id === id)
    if (!target) return
    if (floating) cancelSelectionTransform()
    endStroke()
    pendingHistoryRef.current = null
    activeDocRef.current = id
    setActiveDocumentId(id)
    layersRef.current = target.layers
    activeLayerIdRef.current = target.activeLayerId
    historyRef.current = target.history
    futureRef.current = target.future
    setFloating(null)
    setStatus(`Проект: ${target.filename}`)
  }, [cancelSelectionTransform, endStroke, floating])

  const newProject = useCallback(() => setNewDocumentOpen(true), [])

  const newSprite = useCallback((width: number, height: number) => {
    const doc = createBlankDocument(nextUntitledName(documentsRef.current, projectExtension), width, height)
    const next = [...documentsRef.current, doc]
    documentsRef.current = next
    setDocuments(next)
    activateDocument(doc.id)
    setNewDocumentOpen(false)
    setViewMode('2d')
    setShowUv(false)
    setStatus(`Новый холст ${doc.width}×${doc.height}`)
  }, [activateDocument])

  const performCloseDocument = useCallback((id: string) => {
    const current = documentsRef.current
    const index = current.findIndex((document) => document.id === id)
    if (index < 0) return
    const doc = current[index]
    let next = current.filter((document) => document.id !== id)
    if (!next.length) next = [mode === 'rawsprite'
      ? createBlankDocument('Без названия 1.rsp', 64, 64)
      : createBlankDocument('Без названия 1.mts', 64, 32)]
    documentsRef.current = next
    setDocuments(next)
    if (activeDocRef.current === id) activateDocument(next[Math.min(index, next.length - 1)].id)
    else setStatus(`Проект закрыт: ${doc.filename}`)
  }, [activateDocument])

  const closeDocument = useCallback((id: string) => {
    const doc = documentsRef.current.find((document) => document.id === id)
    if (!doc) return
    if (doc.dirty) {
      setPendingClose({ id, filename: doc.filename })
      return
    }
    performCloseDocument(id)
  }, [performCloseDocument])

  const closeActiveProject = useCallback(() => closeDocument(activeDocRef.current), [closeDocument])

  const cycleDocument = useCallback((direction: 1 | -1) => {
    const docs = documentsRef.current
    if (docs.length < 2) return
    const index = docs.findIndex((document) => document.id === activeDocRef.current)
    const target = docs[(index + direction + docs.length) % docs.length]
    activateDocument(target.id)
  }, [activateDocument])

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
    const layer = createLayer(nextLayerName(current), undefined, width, height)
    const insertAt = index < 0 ? current.length : index + 1
    applyLayers([...current.slice(0, insertAt), layer, ...current.slice(insertAt)], `Создан слой «${layer.name}»`, layer.id)
  }, [applyLayers, pushHistory, width, height, historyLimit])

  const duplicateLayer = useCallback((id: string) => {
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === id)
    if (index < 0) return
    pushHistory()
    const copy = cloneLayer(current[index])
    applyLayers([...current.slice(0, index + 1), copy, ...current.slice(index + 1)], `Дублирован слой «${current[index].name}»`, copy.id)
  }, [applyLayers, pushHistory, width, height, historyLimit])

  const deleteLayer = useCallback((id: string) => {
    const current = layersRef.current
    if (current.length < 2) { setStatus('Нельзя удалить единственный слой'); return }
    const index = current.findIndex((layer) => layer.id === id)
    if (index < 0) return
    pushHistory()
    const next = current.filter((layer) => layer.id !== id)
    const fallback = next[Math.min(index, next.length - 1)]
    applyLayers(next, 'Слой удалён', id === activeLayerIdRef.current ? fallback.id : activeLayerIdRef.current)
  }, [applyLayers, pushHistory, width, height, historyLimit])

  const moveLayerBy = useCallback((id: string, direction: 1 | -1) => {
    const current = layersRef.current
    const next = moveLayerInStack(current, id, direction)
    if (next === current) return
    pushHistory()
    applyLayers(next, direction > 0 ? 'Слой поднят' : 'Слой опущен')
  }, [applyLayers, pushHistory, width, height, historyLimit])

  const mergeDown = useCallback((id: string) => {
    const current = layersRef.current
    const index = current.findIndex((layer) => layer.id === id)
    if (index <= 0) { setStatus('Ниже нет слоя для объединения'); return }
    const upper = current[index]
    if (!upper.visible) { setStatus(`Слой «${upper.name}» скрыт — включи видимость для объединения`); return }
    pushHistory()
    const lower = current[index - 1]
    const merged: Layer = { ...lower, pixels: mergeLayerPixels(lower.pixels, upper, width, height) }
    const next = current.map((layer, layerIndex) => layerIndex === index - 1 ? merged : layer).filter((_, layerIndex) => layerIndex !== index)
    applyLayers(next, `Слой «${upper.name}» объединён с «${lower.name}»`, merged.id)
  }, [applyLayers, pushHistory, width, height, historyLimit])

  const toggleLayerVisibility = useCallback((id: string) => {
    const current = layersRef.current
    const layer = current.find((item) => item.id === id)
    if (!layer) return
    pushHistory()
    applyLayers(current.map((item) => item.id === id ? { ...item, visible: !item.visible } : item), layer.visible ? 'Слой скрыт' : 'Слой показан')
  }, [applyLayers, pushHistory, width, height, historyLimit])

  const renameLayer = useCallback((id: string, name: string) => {
    const current = layersRef.current
    const layer = current.find((item) => item.id === id)
    if (!layer || layer.name === name || !name.trim()) return
    pushHistory()
    applyLayers(current.map((item) => item.id === id ? { ...item, name: name.trim() } : item), 'Слой переименован')
  }, [applyLayers, pushHistory, width, height, historyLimit])

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
      const nextHistory = historyLimit <= 1 ? [pending] : [...historyRef.current.slice(-(historyLimit - 1)), pending]
      historyRef.current = nextHistory
      setHistory(nextHistory)
      futureRef.current = []
      setFuture([])
      pendingHistoryRef.current = null
    } else {
      pushHistory()
    }
    applyLayers(current.map((item) => item.id === id ? { ...item, opacity: clamped } : item), `Прозрачность слоя ${clamped}%`)
  }, [applyLayers, pushHistory, width, height, historyLimit])

  // ----- file input --------------------------------------------------------

  const openTexture = useCallback((mode: 'active' | 'new') => {
    importModeRef.current = mode
    fileInputRef.current?.click()
  }, [])
  const openFile = useCallback(() => openTexture('active'), [openTexture])
  const openImportAsNewLayer = useCallback(() => openTexture('new'), [openTexture])
  const openSkinFile = useCallback(() => skinInputRef.current?.click(), [])
  const chooseTool = useCallback((nextTool: ToolId) => {
    setTool((currentTool) => {
      if (nextTool !== 'eyedropper') previousToolRef.current = nextTool
      else if (currentTool !== 'eyedropper') previousToolRef.current = currentTool
      return nextTool
    })
  }, [])
  const selectPaletteColor = useCallback((color: string) => {
    setCurrentColor(color)
  }, [])
  const exportPng = useCallback(() => {
    const target = toPngName(filename)
    void (async () => {
      try {
        const blob = await pixelsToPngBlob(pixels, width, height)
        if (isDesktopRuntime()) {
          const selected = await pickSavePath(target, [{ name: 'PNG image', extensions: ['png'] }], 'Экспорт PNG')
          if (!selected) return
          const finalPath = ensureExtension(selected, 'png')
          await writeBinaryFile(finalPath, new Uint8Array(await blob.arrayBuffer()))
          setStatus(`PNG сохранён: ${basename(finalPath)}`)
        } else {
          const result = await saveBlobInBrowser(blob, target, { accept: { 'image/png': ['.png'] } })
          if (result.saved) {
            setStatus(`PNG сохранён: ${basename(result.handle?.name ?? target)}`)
          }
        }
      } catch (error) {
        console.error(error)
        setStatus(`Не удалось экспортировать PNG: ${error instanceof Error ? error.message : 'ошибка'}`)
      }
    })()
  }, [filename, pixels, width, height])

  const buildProjectFile = useCallback((): ProjectFileV2 => ({
    format: 'minecraft-texture-studio-project',
    version: 3,
    filename,
    width,
    height,
    activeLayerId: activeLayerIdRef.current,
    layers: layersRef.current.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      pixels: layer.pixels,
    })),
    selection,
    settings: {
      currentColor, tool, viewMode, showGrid, showUv,
      show3dGrid, showModelBounds, paintOn3d, crouchPinned, autoRotate, zoom, skinUrl, skinFilename,
    },
    shortcuts,
    palettes: {
      userPalettes: readLocalJson('mts-user-palettes-v1', []),
      savedColors: readLocalJson('mts-saved-colors-v1', []),
      activePalette: localStorage.getItem('mts-active-palette-v1') ?? 'Minecraft · Classic',
    },
  }), [filename, width, height, selection, currentColor, tool, viewMode, showGrid, showUv, show3dGrid, showModelBounds, paintOn3d, crouchPinned, autoRotate, zoom, skinUrl, skinFilename, shortcuts])

  const saveProjectInBrowser = useCallback(async (json: string, saveAs: boolean) => {
    const activeId = activeDocRef.current
    const handle = saveAs ? undefined : browserProjectHandlesRef.current.get(activeId)
    const name = toProjectName(filename, projectExtension)
    const result = await saveBlobInBrowser(
      new Blob([json], { type: projectMime }),
      name,
      { handle, accept: { [projectMime]: [`.${projectExtension}`] } },
    )
    if (!result.saved) return
    if (result.handle) browserProjectHandlesRef.current.set(activeId, result.handle)
    if (activeDocRef.current === activeId) {
      setFilename(basename(result.handle?.name ?? name))
      setDirty(false)
    }
    setStatus(`Проект сохранён (.${projectExtension}) · ${layersRef.current.length} сл.`)
  }, [filename, projectExtension, projectMime, setDirty, setFilename])

  const saveProject = useCallback((saveAs = false) => {
    const json = JSON.stringify(buildProjectFile(), null, 2)
    if (!isDesktopRuntime()) {
      void saveProjectInBrowser(json, saveAs)
      return
    }
    const activeId = activeDocRef.current
    const proposed = projectPath ?? toProjectName(filename, projectExtension)
    void (async () => {
      try {
        const selected = !saveAs && projectPath
          ? projectPath
          : await pickSavePath(proposed, [{ name: projectLabel, extensions: [projectExtension] }], 'Сохранить проект')
        if (!selected) return
        const finalPath = ensureExtension(selected, projectExtension)
        await writeTextFile(finalPath, json)
        if (activeDocRef.current === activeId) {
          setProjectPath(finalPath)
          setFilename(basename(finalPath))
          setDirty(false)
        }
        setStatus(`Проект сохранён: ${basename(finalPath)}`)
      } catch (error) {
        console.error(error)
        setStatus(`Не удалось сохранить проект: ${error instanceof Error ? error.message : 'ошибка'}`)
      }
    })()
  }, [buildProjectFile, filename, projectExtension, projectLabel, projectPath, setDirty, setFilename, setProjectPath, saveProjectInBrowser])

  const saveProjectAs = useCallback(() => saveProject(true), [saveProject])

  const handlePickColor = useCallback((pickedColor: string) => {
    if (pickedColor !== transparentPixel) selectPaletteColor(pickedColor)
    setTool((activeTool) => activeTool === 'eyedropper' ? previousToolRef.current : activeTool)
  }, [selectPaletteColor])

  const applyProject = (nextLayers: Layer[], requestedActiveId: string, project: { filename?: unknown; selection?: unknown; settings?: unknown; shortcuts?: unknown; palettes?: unknown }, fileName: string, projectPath: string | null = null, projectWidth = 64, projectHeight = 32) => {
    if (floating) cancelSelectionTransform()
    const settings = project.settings as Partial<ProjectSettings>
    const activeId = nextLayers.some((layer) => layer.id === requestedActiveId) ? requestedActiveId : nextLayers[nextLayers.length - 1].id
    const loadedFilename = projectPath
      ? basename(projectPath)
      : typeof project.filename === 'string'
        ? project.filename
        : fileName.replace(/\.(mts|json)$/i, '.png')
    const doc = createDocument(loadedFilename, nextLayers, {
      width: projectWidth,
      height: projectHeight,
      activeLayerId: activeId,
      selection: readProjectSelection(project.selection, projectWidth, projectHeight),
      skinUrl: typeof settings.skinUrl === 'string' ? settings.skinUrl : null,
      skinFilename: typeof settings.skinFilename === 'string' ? settings.skinFilename : '',
      zoom: typeof settings.zoom === 'number' && Number.isFinite(settings.zoom)
        ? Math.min(2048, Math.max(2, Math.round(settings.zoom)))
        : 10,
      projectPath,
    })
    const currentDocs = documentsRef.current
    // A single untouched "new document" tab is replaced instead of leaving an empty tab behind.
    const canReplace = currentDocs.length === 1 && !currentDocs[0].dirty && currentDocs[0].history.length === 0 && currentDocs[0].layers.length === 1
    const nextDocs = canReplace ? [doc] : [...currentDocs, doc]
    documentsRef.current = nextDocs
    setDocuments(nextDocs)
    activateDocument(doc.id)

    if (typeof settings.currentColor === 'string') setCurrentColor(settings.currentColor)
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

    if (project.shortcuts && typeof project.shortcuts === 'object') {
      const nextShortcuts = normalizeShortcuts(project.shortcuts as Partial<ShortcutMap>)
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
  }

  const loadProjectText = (text: string, fileName: string, projectPath: string | null) => {
    try {
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Файл проекта повреждён')
      const project = parsed as Record<string, unknown>
      if (project.format !== 'minecraft-texture-studio-project') throw new Error('Неподдерживаемый формат проекта')
      if (project.version !== 1 && project.version !== 2 && project.version !== 3) throw new Error('Неподдерживаемая версия проекта')
      if (typeof project.settings !== 'object' || project.settings === null) throw new Error('В проекте отсутствуют настройки')

      const projectWidth = project.version === 3 && typeof project.width === 'number' && Number.isFinite(project.width)
        ? Math.max(1, Math.min(2048, Math.round(project.width)))
        : 64
      const projectHeight = project.version === 3 && typeof project.height === 'number' && Number.isFinite(project.height)
        ? Math.max(1, Math.min(2048, Math.round(project.height)))
        : 32

      let nextLayers: Layer[]
      let requestedActiveId = ''
      if (project.version === 2 || project.version === 3) {
        const parsedLayers = parseProjectLayers(project.layers, projectWidth, projectHeight)
        if (!parsedLayers) throw new Error(`В проекте нет корректных слоёв ${projectWidth}×${projectHeight}`)
        nextLayers = parsedLayers
        requestedActiveId = typeof project.activeLayerId === 'string' ? project.activeLayerId : ''
      } else {
        if (!isPixelArray(project.pixels, 64 * 32)) throw new Error('В проекте нет корректной текстуры 64×32')
        nextLayers = layersFromPixels(project.pixels, 'Слой 1', 64, 32)
      }
      applyProject(nextLayers, requestedActiveId, project, fileName, projectPath, projectWidth, projectHeight)
    } catch (error) {
      console.error(error)
      setStatus(error instanceof Error ? `Ошибка проекта: ${error.message}` : 'Не удалось открыть проект')
    }
  }

  const openProject = async () => {
    if (!isDesktopRuntime()) {
      projectInputRef.current?.click()
      return
    }
    try {
      const path = await pickOpenPath([{ name: projectLabel, extensions: [projectExtension, 'json'] }], 'Открыть проект')
      if (!path) return
      loadProjectText(await readTextFile(path), basename(path), path)
    } catch (error) {
      console.error(error)
      setStatus(`Не удалось открыть проект: ${error instanceof Error ? error.message : 'ошибка'}`)
    }
  }

  const handleOpenProjectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      loadProjectText(await file.text(), file.name, null)
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
      // In-app confirmation dialogs own Escape/Enter and block background shortcuts.
      if (document.querySelector('.confirm-dialog')) return
      if (event.ctrlKey && !event.altKey && event.key === 'Tab') {
        event.preventDefault()
        cycleDocument(event.shiftKey ? -1 : 1)
        return
      }
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
        case 'saveProjectAs': saveProjectAs(); break
        case 'newProject': newProject(); break
        case 'closeProject': closeActiveProject(); break
        case 'export': exportPng(); break
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
  }, [shortcuts, showShortcuts, viewMode, undo, redo, openFile, openProject, saveProject, saveProjectAs, exportPng, chooseTool, copySelection, copyMerged, cutSelection, pasteClipboard, pasteClipboardAsNewLayer, deleteSelection, selectAll, deselect, floating, cancelSelectionTransform, newProject, closeActiveProject, cycleDocument])

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
      setDirty(true)
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
      const placed = placePixels(imported.pixels, imported.width, imported.height, width, height)
      const tooLarge = imported.width > width || imported.height > height
      const sizeNote = imported.width === width && imported.height === height
        ? `${width}×${height}`
        : `${imported.width}×${imported.height} → ${width}×${height}${tooLarge ? ', обрезано' : ''}`
      pushHistory()
      if (asNewLayer) {
        const current = layersRef.current
        const index = current.findIndex((layer) => layer.id === activeLayerIdRef.current)
        const layerName = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 40) || 'Импорт'
        const layer = createLayer(layerName, placed, width, height)
        const insertAt = index < 0 ? current.length : index + 1
        applyLayers([...current.slice(0, insertAt), layer, ...current.slice(insertAt)], `Импортировано в новый слой «${layerName}» (${sizeNote})`, layer.id)
      } else {
        const next = layersRef.current.map((layer) => layer.id === activeLayerIdRef.current ? { ...layer, pixels: placed } : layer)
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
    pushHistory()
    const layer = createLayer('Слой 1', undefined, width, height)
    layersRef.current = [layer]
    activeLayerIdRef.current = layer.id
    setLayers([layer])
    setActiveLayerId(layer.id)
    setSelection(null)
    setClipboard(null)
    setFilename(mode === 'rawsprite' ? 'Без названия.rsp' : 'untitled-elytra.png')
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
    { label: 'Копировать', shortcut: shortcuts.copy, icon: <XpIcon name="copy" size={14} />, action: copySelection },
    { label: 'Копировать объединённое', shortcut: shortcuts.copyMerged, icon: <Layers3 size={14} />, action: copyMerged },
    { label: 'Вырезать', shortcut: shortcuts.cut, icon: <XpIcon name="cut" size={14} />, action: cutSelection },
    { label: 'Вставить', shortcut: shortcuts.paste, icon: <XpIcon name="paste" size={14} />, disabled: !clipboard, action: pasteClipboard },
    { label: 'Вставить в новый слой', shortcut: shortcuts.pasteNewLayer, icon: <Layers3 size={14} />, disabled: !clipboard, action: pasteClipboardAsNewLayer },
    { label: 'Очистить выделение', shortcut: shortcuts.deleteSelection, icon: <XpIcon name="delete" size={14} />, danger: true, action: deleteSelection },
    { separator: true },
    { label: 'Выделить весь холст', shortcut: shortcuts.selectAll, action: selectAll },
    { label: 'Снять выделение', shortcut: shortcuts.deselect, disabled: !selection, action: deselect },
  ]

  const fileMenu: ContextMenuItem[] = [
    { label: 'Новый проект…', shortcut: shortcuts.newProject, icon: <XpIcon name="newfolder" size={14} />, action: newProject },
    { label: 'Открыть проект…', shortcut: shortcuts.openProject, icon: <XpIcon name="folder" size={14} />, action: openProject },
    { label: 'Сохранить проект', shortcut: shortcuts.saveProject, icon: <XpIcon name="save" size={14} />, action: () => saveProject() },
    { label: 'Сохранить как…', shortcut: shortcuts.saveProjectAs, icon: <XpIcon name="save" size={14} />, action: saveProjectAs },
    { label: 'Закрыть проект', shortcut: shortcuts.closeProject, icon: <XpIcon name="delete" size={14} />, action: closeActiveProject },
    { separator: true },
    { label: 'Открыть текстуру…', shortcut: shortcuts.open, icon: <XpIcon name="open" size={14} />, action: openFile },
    { label: 'Импортировать как новый слой…', icon: <Layers3 size={14} />, action: openImportAsNewLayer },
    ...(previewAvailable ? [{ label: 'Загрузить скин модели…', icon: <UserRound size={14} />, action: openSkinFile }] : []),
    { separator: true },
    { label: 'Экспортировать PNG…', shortcut: shortcuts.export, icon: <XpIcon name="bitmap" size={14} />, action: exportPng },
    { separator: true },
    { label: 'Очистить текущую текстуру', icon: <XpIcon name="application" size={14} />, action: resetTexture },
  ]
  const editMenu: ContextMenuItem[] = [
    { label: 'Отменить', shortcut: shortcuts.undo, icon: <XpIcon name="undo" size={14} />, disabled: history.length === 0, action: undo },
    { label: 'Повторить', shortcut: shortcuts.redo, icon: <XpIcon name="redo" size={14} />, disabled: future.length === 0, action: redo },
    { separator: true },
    ...selectionActions,
    { separator: true },
  ]
  const viewMenu: ContextMenuItem[] = previewAvailable ? [
    { label: 'Только 2D', checked: viewMode === '2d', action: () => setViewMode('2d') },
    { label: '2D + 3D', checked: viewMode === 'split', action: () => setViewMode('split') },
    { label: 'Только 3D', checked: viewMode === '3d', action: () => setViewMode('3d') },
    { separator: true },
    { label: 'Сетка 2D', checked: showGrid, action: () => setShowGrid((value) => !value) },
    { label: 'UV-направляющие', checked: showUv, action: () => setShowUv((value) => !value) },
    { label: 'Сетка на модели', checked: show3dGrid, action: () => setShow3dGrid((value) => !value) },
    { label: 'Границы геометрии', checked: showModelBounds, action: () => setShowModelBounds((value) => !value) },
  ] : [
    { label: '2D', checked: true },
    { separator: true },
    { label: 'Сетка пикселей', checked: showGrid, action: () => setShowGrid((value) => !value) },
  ]
  const layerMenu: ContextMenuItem[] = [
    { label: 'Новый слой', icon: <XpIcon name="newfolder" size={14} />, action: addLayer },
    { label: 'Дублировать слой', icon: <XpIcon name="copy" size={14} />, disabled: !activeLayer, action: () => duplicateLayer(activeLayerId) },
    { label: 'Объединить с нижним', icon: <Merge size={14} />, disabled: activeLayerIndex <= 0, action: () => mergeDown(activeLayerId) },
    { separator: true },
    { label: 'Поднять слой', icon: <ChevronUp size={14} />, disabled: activeLayerIndex >= layers.length - 1, action: () => moveLayerBy(activeLayerId, 1) },
    { label: 'Опустить слой', icon: <ChevronDown size={14} />, disabled: activeLayerIndex <= 0, action: () => moveLayerBy(activeLayerId, -1) },
    { separator: true },
    { label: activeLayer?.visible ? 'Скрыть слой' : 'Показать слой', checked: activeLayer?.visible, action: () => toggleLayerVisibility(activeLayerId) },
    { label: 'Удалить слой', danger: true, icon: <XpIcon name="delete" size={14} />, disabled: layers.length < 2, action: () => deleteLayer(activeLayerId) },
  ]
  const toolsMenu: ContextMenuItem[] = [
    ...tools.map((item) => ({ label: item.label, shortcut: shortcuts[item.shortcut], checked: tool === item.id, action: () => chooseTool(item.id) })),
    ...(previewAvailable ? [
      { separator: true },
      { label: 'Рисовать по 3D-модели', checked: paintOn3d, action: () => setPaintOn3d((value) => !value) },
      { label: 'Присяд + раскрытие элитр', shortcut: 'Shift', checked: crouching, action: () => setCrouchPinned((value) => !value) },
      { label: 'Автовращение модели', checked: autoRotate, action: () => setAutoRotate((value) => !value) },
    ] : []),
  ]
  const settingsMenu: ContextMenuItem[] = [
    { label: 'Настроить горячие клавиши…', icon: <Keyboard size={14} />, action: () => setShowShortcuts(true) },
    ...(previewAvailable ? [{ label: 'Сбросить скин модели', icon: <RotateCw size={14} />, disabled: !skinUrl, action: () => { setSkinUrl(null); setSkinFilename(''); setDirty(true); setStatus('Возвращён стандартный скин модели') } }] : []),
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
          <div className="brand-mark"><XpIcon name="paint" size={26} /></div>
          <div className="brand-text">{mode === 'rawsprite'
            ? <strong>Raw<span>Sprite</span></strong>
            : <strong>Minecraft <span>Texture Studio</span></strong>}<small>{mode === 'rawsprite' ? 'PIXEL ART EDITOR' : 'PIXEL TEXTURE EDITOR'}</small></div>
        </div>
        <div className="document-title">
          <FileImage size={15} />
          <input aria-label="Имя файла" value={filename} onChange={(event) => { setFilename(event.target.value); setDirty(true) }} />
          {dirty && <span className="dirty-dot" title="Есть несохранённые изменения" />}
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/*" onChange={handleImport} hidden />
        <input ref={projectInputRef} type="file" accept={mode === 'rawsprite' ? '.rsp,.json,application/json' : '.mts,.json,application/json'} onChange={handleOpenProjectFile} hidden />
        <input ref={skinInputRef} type="file" accept="image/png" onChange={handleImportSkin} hidden />
      </header>

      <div className="document-tabs" role="tablist" aria-label="Открытые проекты">
        {documents.map((document) => {
          const isActive = document.id === activeDocumentId
          return (
            <div
              key={document.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              className={`document-tab ${isActive ? 'document-tab-active' : ''}`}
              title={`${document.filename}${document.dirty ? ' — не сохранён' : ''}`}
              onClick={() => activateDocument(document.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  activateDocument(document.id)
                }
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  closeDocument(document.id)
                }
              }}
            >
              <FileImage size={12} />
              <span className="document-tab-name">{document.filename || 'Без названия'}</span>
              {document.dirty && <span className="document-tab-dirty" title="Не сохранён" />}
              <button
                type="button"
                className="document-tab-close"
                title="Закрыть проект"
                aria-label={`Закрыть ${document.filename}`}
                onClick={(event) => { event.stopPropagation(); closeDocument(document.id) }}
              ><X size={11} /></button>
            </div>
          )
        })}
        <button type="button" className="document-tab-new" onClick={newProject} title={`Новый проект (${shortcuts.newProject})`} aria-label="Новый проект"><Plus size={13} /></button>
      </div>

      <nav className="classic-menu-bar" aria-label="Главное меню">
        <button onClick={(event) => openContextMenu(event, fileMenu)}>Файл</button>
        <button onClick={(event) => openContextMenu(event, editMenu)}>Правка</button>
        <button onClick={(event) => openContextMenu(event, viewMenu)}>Вид</button>
        <button onClick={(event) => openContextMenu(event, [
          { label: 'Импортировать текстуру…', icon: <FileImage size={14} />, action: openFile },
          { label: 'Импортировать как новый слой…', icon: <Layers3 size={14} />, action: openImportAsNewLayer },
          { label: 'Экспортировать PNG…', icon: <XpIcon name="bitmap" size={14} />, action: exportPng },
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
          <button className="toolbar-action" onClick={undo} disabled={!history.length} title="Отменить"><XpIcon name="undo" size={16} /></button>
          <button className="toolbar-action" onClick={redo} disabled={!future.length} title="Повторить"><XpIcon name="redo" size={16} /></button>
          <span className="toolbar-divider" />
          <button className={`toolbar-action ${activeGridVisible ? 'toolbar-action-active' : ''}`} onClick={toggleActiveGrid} title={`${activeGridTitle} (${shortcuts.toggleGrid})`} aria-label={activeGridTitle}><Grid2X2 size={15} /></button>
          {previewAvailable && <button className={`toolbar-action ${showUv ? 'toolbar-action-active' : ''}`} onClick={() => setShowUv((value) => !value)} title={`UV-шаблон (${shortcuts.toggleUv})`}><Eye size={15} /></button>}
          <span className="toolbar-divider" />
          <span className="zoom-label">МАСШТАБ</span>
          <button className="toolbar-action zoom-step" onClick={() => setZoom((value) => Math.max(0.05, value / 1.2))} title="Уменьшить масштаб"><ZoomOut size={14} /></button>
          <span className="zoom-value">{Math.round(zoom * 1000) / 10}%</span>
          <button className="toolbar-action zoom-step" onClick={() => setZoom((value) => Math.min(2048, value * 1.2))} title="Увеличить масштаб"><ZoomIn size={14} /></button>
          <button className="toolbar-action" onClick={() => setZoom(Math.max(0.05, Math.min(16, Math.min(960 / width, 720 / height))))} title="Вписать холст" aria-label="Вписать холст"><Maximize2 size={14} /></button>
        </div>
        {previewAvailable && <div className="view-switcher" role="group" aria-label="Режим отображения">
          <button onClick={() => switchView('2d')} className={viewMode === '2d' ? 'view-option active' : 'view-option'}><PanelsTopLeft size={14} /> 2D</button>
          <button onClick={() => switchView('split')} className={viewMode === 'split' ? 'view-option active' : 'view-option'}><Maximize2 size={14} /> Split</button>
          <button onClick={() => switchView('3d')} className={viewMode === '3d' ? 'view-option active' : 'view-option'}><Box size={14} /> 3D</button>
        </div>}
      </div>

      <main className={`main-layout mode-${viewMode}`}>
        <aside className="left-sidebar">
          <PalettePanel
            currentColor={currentColor}
            onSelectColor={selectPaletteColor}
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
          <div className="panel-topline"><div className="panel-title"><span className="panel-title-dot" /> <span>{mode === 'rawsprite' ? 'СПРАЙТ' : 'ТЕКСТУРА'}</span>{mode === 'minecraft' && <span className="panel-subtitle">/ UV ATLAS</span>}</div><div className="panel-tools">
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
            width={width}
            height={height}
            tool={tool}
            color={currentColor}
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
            onZoomReset={() => setZoom(Math.max(0.05, Math.min(16, Math.min(960 / width, 720 / height))))}
            onSetTool={chooseTool}
            onImportTexture={openFile}
            onExportTexture={exportPng}
            onClearTexture={resetTexture}
          />
          <footer className="editor-status"><span><span className="status-led" /> {status}</span><span>{layers.length} сл. · PNG · RGBA · nearest-neighbor</span></footer>
        </section>

        {mode === 'minecraft' && Preview && (
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
          <Preview pixels={displayPixels} width={width} height={height} visible={viewMode !== '2d'} autoRotate={autoRotate} skinUrl={skinUrl} tool={tool} color={currentColor} showGrid={show3dGrid} showBounds={showModelBounds} paintEnabled={paintOn3d} crouching={crouching} onPaintLine={paint} onFill={fill} onStrokeStart={beginStroke} onStrokeEnd={endStroke} onPick={handlePickColor} onNotice={setStatus} onTogglePaint={() => setPaintOn3d((value) => !value)} onToggleGrid={() => setShow3dGrid((value) => !value)} onToggleBounds={() => setShowModelBounds((value) => !value)} onToggleCrouch={() => setCrouchPinned((value) => !value)} onToggleAutoRotate={() => setAutoRotate((value) => !value)} />
        </section>
        )}

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
          <button className="tool-button" onClick={resetTexture} title="Новая пустая текстура"><Sparkles size={18} /></button>
          <div className="toolbar-spacer" />
          <div className="tool-color-stack" title={`Текущий цвет ${currentColor}`}>
            <span className="foreground-color current-color" style={{ background: currentColor }} aria-label="Текущий цвет" />
          </div>
        </aside>
      </main>
      {showShortcuts && <ShortcutsModal shortcuts={shortcuts} onChange={setBinding} onClose={() => setShowShortcuts(false)} onReset={() => { setShortcuts(defaultShortcuts); localStorage.removeItem('mts-shortcuts-v1') }} />}
      <NewDocumentDialog open={newDocumentOpen} defaultWidth={64} defaultHeight={mode === 'rawsprite' ? 64 : 32} onCancel={() => setNewDocumentOpen(false)} onCreate={newSprite} />
      <ConfirmDialog
        open={pendingClose !== null}
        title="Закрытие проекта"
        message={pendingClose ? `Закрыть проект «${pendingClose.filename}» без сохранения?` : ''}
        confirmLabel="Закрыть"
        cancelLabel="Отмена"
        danger
        onConfirm={() => {
          if (pendingClose) performCloseDocument(pendingClose.id)
          setPendingClose(null)
        }}
        onCancel={() => setPendingClose(null)}
      />
    </div>
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
