import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { pixelIndex, TEXTURE_HEIGHT, TEXTURE_WIDTH } from '../utils/texture'
import { containsPoint, normalizeRect, shapePoints } from '../utils/shapes'
import type { SelectionRect, Shape } from '../utils/shapes'
import type { TransformRect } from '../utils/transform'
import { useContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { transparentPixel } from '../data/palettes'
import type { ShortcutMap } from './ShortcutsModal'
import type { ToolId } from '../App'

type Props = {
  pixels: string[]
  tool: ToolId
  color: string
  secondaryColor: string
  zoom: number
  showGrid: boolean
  showUv: boolean
  shortcuts: ShortcutMap
  selection: SelectionRect | null
  selectionActions: ContextMenuItem[]
  transformRect: SelectionRect | null
  onTransformStart: () => boolean
  onTransformUpdate: (rect: TransformRect) => void
  onTransformCommit: (rect: TransformRect) => void
  onTransformCancel: () => void
  onZoomChange: (zoom: number) => void
  onPaintLine: (x0: number, y0: number, x1: number, y1: number, color: string) => void
  onFill: (x: number, y: number, color?: string) => void
  onStrokeStart: () => void
  onStrokeEnd: () => void
  onDrawShape: (shape: Shape, color: string) => void
  onSelectionChange: (selection: SelectionRect | null) => void
  onPick: (color: string) => void
  onCursor: (x: number, y: number) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onToggleGrid: () => void
  onToggleUv: () => void
  onZoomReset: () => void
  onSetTool: (tool: ToolId) => void
  onImportTexture: () => void
  onExportTexture: () => void
  onClearTexture: () => void
}

const MIN_ZOOM = 2
const MAX_ZOOM = 2048

const uvFaces = [
  { x: 24, y: 0, w: 10, h: 2, name: 'TOP' },
  { x: 34, y: 0, w: 10, h: 2, name: 'BOTTOM' },
  { x: 22, y: 2, w: 2, h: 20, name: 'SIDE' },
  { x: 24, y: 2, w: 10, h: 20, name: 'INNER / FRONT' },
  { x: 34, y: 2, w: 2, h: 20, name: 'SIDE' },
  { x: 36, y: 2, w: 12, h: 20, name: 'OUTER / BACK' },
]

type ZoomAnchor = { clientX: number; clientY: number; pixelX: number; pixelY: number } | null

type DragState =
  | { kind: 'stroke'; lastPixel: [number, number]; color: string }
  | { kind: 'select'; anchor: [number, number]; current: [number, number] }
  | { kind: 'shape'; shape: Shape; color: string }
  | { kind: 'transform'; mode: 'move' | HandleId; startRect: TransformRect; startPixel: [number, number]; rect: TransformRect }

const HANDLE_IDS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type HandleId = typeof HANDLE_IDS[number]

function rectToTransform(rect: SelectionRect): TransformRect {
  return { x: rect.x0, y: rect.y0, width: rect.x1 - rect.x0 + 1, height: rect.y1 - rect.y0 + 1 }
}

function handlePoint(rect: TransformRect, id: HandleId): [number, number] {
  const left = rect.x
  const right = rect.x + rect.width
  const top = rect.y
  const bottom = rect.y + rect.height
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const x = id.includes('w') ? left : id.includes('e') ? right : centerX
  const y = id.includes('n') ? top : id.includes('s') ? bottom : centerY
  return [x, y]
}

function hitHandle(rect: TransformRect, pointerX: number, pointerY: number, zoom: number): HandleId | null {
  for (const id of HANDLE_IDS) {
    const [hx, hy] = handlePoint(rect, id)
    if (Math.abs(pointerX - hx * zoom) <= 6 && Math.abs(pointerY - hy * zoom) <= 6) return id
  }
  return null
}

function pointInside(rect: TransformRect, pointerX: number, pointerY: number, zoom: number): boolean {
  return pointerX >= rect.x * zoom && pointerX <= (rect.x + rect.width) * zoom
    && pointerY >= rect.y * zoom && pointerY <= (rect.y + rect.height) * zoom
}

const SHAPE_TOOLS = ['line', 'rect', 'ellipse'] as const
type ShapeTool = typeof SHAPE_TOOLS[number]

function isShapeTool(tool: ToolId): tool is ShapeTool {
  return (SHAPE_TOOLS as readonly ToolId[]).includes(tool)
}

export default function TextureCanvas({
  pixels, tool, color, secondaryColor, zoom, showGrid, showUv, shortcuts, selection, selectionActions,
  transformRect, onTransformStart, onTransformUpdate, onTransformCommit, onTransformCancel,
  onZoomChange, onPaintLine, onFill, onStrokeStart, onStrokeEnd, onDrawShape, onSelectionChange, onPick, onCursor, onUndo, onRedo,
  canUndo, canRedo, onToggleGrid, onToggleUv, onZoomReset, onSetTool, onImportTexture, onExportTexture, onClearTexture,
}: Props) {
  const { openContextMenu, openContextMenuAt } = useContextMenu()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const zoomAnchor = useRef<ZoomAnchor>(null)
  const rightPressRef = useRef<{ pixel: [number, number]; clientX: number; clientY: number } | null>(null)
  const rightDragRef = useRef(false)
  // Chromium dispatches `contextmenu` on right-button press, before the drag proves
  // itself. Painting tools therefore defer it to pointerup and remember whether the
  // menu was already shown for this press.
  const menuOpenedByPressRef = useRef(false)
  const suppressContextMenuRef = useRef(false)
  const lastClientRef = useRef<{ x: number; y: number } | null>(null)
  const [hoverPixel, setHoverPixel] = useState<[number, number] | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [rightButtonHeld, setRightButtonHeld] = useState(false)
  const [draftShape, setDraftShape] = useState<Shape | null>(null)
  const [draftSelection, setDraftSelection] = useState<SelectionRect | null>(null)
  const [hoverHandle, setHoverHandle] = useState<HandleId | 'inside' | null>(null)

  const updatePointer = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top })
  }, [])

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current
    if (!anchor || !wrapperRef.current || !scrollerRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const scroller = scrollerRef.current
    // Keep the pixel under the mouse at the same screen position while zooming.
    scroller.scrollLeft += rect.left + anchor.pixelX * zoom - anchor.clientX
    scroller.scrollTop += rect.top + anchor.pixelY * zoom - anchor.clientY
    zoomAnchor.current = null
  }, [zoom])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
    for (let y = 0; y < TEXTURE_HEIGHT; y++) {
      for (let x = 0; x < TEXTURE_WIDTH; x++) {
        const pixel = pixels[pixelIndex(x, y)]
        if (pixel && pixel !== transparentPixel && !(pixel.length === 9 && pixel.endsWith('00'))) {
          context.fillStyle = pixel
          context.fillRect(x, y, 1, 1)
        }
      }
    }
  }, [pixels])

  const getPixel = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect()
    const pixelWidth = rect.width / TEXTURE_WIDTH
    const pixelHeight = rect.height / TEXTURE_HEIGHT
    const x = Math.min(TEXTURE_WIDTH - 1, Math.max(0, Math.floor((event.clientX - rect.left) / pixelWidth)))
    const y = Math.min(TEXTURE_HEIGHT - 1, Math.max(0, Math.floor((event.clientY - rect.top) / pixelHeight)))
    return [x, y]
  }, [])

  const handleWheel = useCallback((event: WheelEvent) => {
    // React registers wheel listeners as passive, so preventDefault() there only
    // logs a warning and the scroller keeps moving. A native non-passive listener
    // makes the wheel zoom exclusively.
    event.preventDefault()
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    const direction = event.deltaY < 0 ? 1 : -1
    const step = Math.max(1, Math.round(zoom * 0.15))
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + direction * step))
    if (nextZoom === zoom) return
    zoomAnchor.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pixelX: Math.max(0, Math.min(TEXTURE_WIDTH, (event.clientX - rect.left) / zoom)),
      pixelY: Math.max(0, Math.min(TEXTURE_HEIGHT, (event.clientY - rect.top) / zoom)),
    }
    onZoomChange(nextZoom)
  }, [zoom, onZoomChange])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    wrapper.addEventListener('wheel', handleWheel, { passive: false })
    return () => wrapper.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const hoverIndex = hoverPixel ? pixelIndex(hoverPixel[0], hoverPixel[1]) : -1
  const oldHoverColor = hoverIndex >= 0 ? (pixels[hoverIndex] ?? transparentPixel) : transparentPixel
  const previewColor = tool === 'eraser' || tool === 'eyedropper' ? oldHoverColor : (rightButtonHeld ? secondaryColor : color)
  // Painting tools preview the resulting color in the target cell; selection and shape
  // tools only outline the cell, and the cursor dot shows the exact pointer position.
  const filledPreview = tool === 'brush' || tool === 'eraser' || tool === 'fill' || tool === 'eyedropper'
  const visibleSelection = draftSelection ?? transformRect ?? selection
  const activeTransform = transformRect ? rectToTransform(transformRect) : selection ? rectToTransform(selection) : null

  const resetPressState = () => {
    rightPressRef.current = null
    rightDragRef.current = false
    menuOpenedByPressRef.current = false
    setRightButtonHeld(false)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 2) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    // A new press always starts with a clean slate, so a stroke that ended off-canvas
    // cannot swallow the following context menu.
    suppressContextMenuRef.current = false
    menuOpenedByPressRef.current = false
    const [x, y] = getPixel(event)
    lastClientRef.current = { x: event.clientX, y: event.clientY }
    updatePointer(event)
    setHoverPixel([x, y])
    setRightButtonHeld(event.button === 2)
    onCursor(x, y)

    // A stationary right click opens the editor context menu. Right-drag still paints with BG.
    if (event.button === 2) {
      rightPressRef.current = { pixel: [x, y], clientX: event.clientX, clientY: event.clientY }
      rightDragRef.current = false
      return
    }
    if (tool === 'select') {
      const sourceRect = transformRect ?? selection
      const wrapper = wrapperRef.current
      if (sourceRect && wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect()
        const pointerX = event.clientX - wrapperRect.left
        const pointerY = event.clientY - wrapperRect.top
        const candidate = rectToTransform(sourceRect)
        const handle = hitHandle(candidate, pointerX, pointerY, zoom)
        const inside = pointInside(candidate, pointerX, pointerY, zoom)
        if (handle || inside) {
          if (!onTransformStart()) return
          dragRef.current = { kind: 'transform', mode: handle ?? 'move', startRect: candidate, startPixel: [x, y], rect: candidate }
          return
        }
      }
      dragRef.current = { kind: 'select', anchor: [x, y], current: [x, y] }
      setDraftSelection(normalizeRect(x, y, x, y))
      return
    }
    if (isShapeTool(tool)) {
      const shape: Shape = { kind: tool, x0: x, y0: y, x1: x, y1: y }
      dragRef.current = { kind: 'shape', shape, color }
      setDraftShape(shape)
      return
    }
    if (tool === 'eyedropper') {
      onPick(pixels[pixelIndex(x, y)] || transparentPixel)
      return
    }
    if (tool === 'fill') {
      onFill(x, y, color)
      return
    }
    const strokeColor = tool === 'eraser' ? transparentPixel : color
    dragRef.current = { kind: 'stroke', lastPixel: [x, y], color: strokeColor }
    onStrokeStart()
    onPaintLine(x, y, x, y, strokeColor)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const [x, y] = getPixel(event)
    lastClientRef.current = { x: event.clientX, y: event.clientY }
    updatePointer(event)
    setHoverPixel([x, y])
    setRightButtonHeld((event.buttons & 2) !== 0)
    onCursor(x, y)

    const pendingRight = rightPressRef.current
    if (pendingRight && (event.buttons & 2) !== 0 && (tool === 'brush' || tool === 'eraser')) {
      const distance = Math.hypot(event.clientX - pendingRight.clientX, event.clientY - pendingRight.clientY)
      if (distance > 3) {
        rightDragRef.current = true
        const strokeColor = tool === 'eraser' ? transparentPixel : secondaryColor
        dragRef.current = { kind: 'stroke', lastPixel: pendingRight.pixel, color: strokeColor }
        onStrokeStart()
        onPaintLine(pendingRight.pixel[0], pendingRight.pixel[1], pendingRight.pixel[0], pendingRight.pixel[1], strokeColor)
        rightPressRef.current = null
      }
    }

    const drag = dragRef.current
    if (!drag) {
      const sourceRect = transformRect ?? selection
      const wrapper = wrapperRef.current
      if (tool === 'select' && sourceRect && wrapper) {
        const wrapperRect = wrapper.getBoundingClientRect()
        const pointerX = event.clientX - wrapperRect.left
        const pointerY = event.clientY - wrapperRect.top
        const candidate = rectToTransform(sourceRect)
        const handle = hitHandle(candidate, pointerX, pointerY, zoom)
        setHoverHandle(handle ?? (pointInside(candidate, pointerX, pointerY, zoom) ? 'inside' : null))
      } else {
        setHoverHandle(null)
      }
      return
    }
    if (drag.kind === 'transform') {
      const dx = x - drag.startPixel[0]
      const dy = y - drag.startPixel[1]
      let rect: TransformRect
      if (drag.mode === 'move') {
        rect = {
          x: Math.max(1 - drag.startRect.width, Math.min(TEXTURE_WIDTH - 1, drag.startRect.x + dx)),
          y: Math.max(1 - drag.startRect.height, Math.min(TEXTURE_HEIGHT - 1, drag.startRect.y + dy)),
          width: drag.startRect.width,
          height: drag.startRect.height,
        }
      } else {
        const start = drag.startRect
        let left = start.x
        let top = start.y
        let right = start.x + start.width
        let bottom = start.y + start.height
        if (drag.mode.includes('w')) left = Math.min(start.x + dx, right - 1)
        if (drag.mode.includes('e')) right = Math.max(right + dx, left + 1)
        if (drag.mode.includes('n')) top = Math.min(start.y + dy, bottom - 1)
        if (drag.mode.includes('s')) bottom = Math.max(bottom + dy, top + 1)
        left = Math.max(0, left)
        top = Math.max(0, top)
        right = Math.min(TEXTURE_WIDTH, Math.max(left + 1, right))
        bottom = Math.min(TEXTURE_HEIGHT, Math.max(top + 1, bottom))
        rect = { x: left, y: top, width: right - left, height: bottom - top }
      }
      drag.rect = rect
      onTransformUpdate(rect)
      return
    }
    if (drag.kind === 'select') {
      drag.current = [x, y]
      setDraftSelection(normalizeRect(drag.anchor[0], drag.anchor[1], x, y))
      return
    }
    if (drag.kind === 'shape') {
      drag.shape = { ...drag.shape, x1: x, y1: y }
      setDraftShape(drag.shape)
      return
    }
    const [lastX, lastY] = drag.lastPixel
    if (x !== lastX || y !== lastY) {
      onPaintLine(lastX, lastY, x, y, drag.color)
      drag.lastPixel = [x, y]
    }
  }

  const buildCanvasMenu = (): ContextMenuItem[] => [
    { label: 'Отменить', shortcut: shortcuts.undo, disabled: !canUndo, action: onUndo },
    { label: 'Повторить', shortcut: shortcuts.redo, disabled: !canRedo, action: onRedo },
    { separator: true },
    ...selectionActions,
    { separator: true },
    { label: 'Импортировать PNG…', shortcut: shortcuts.open, action: onImportTexture },
    { label: 'Экспортировать PNG…', shortcut: shortcuts.export, action: onExportTexture },
    { label: 'Очистить текстуру…', danger: true, action: onClearTexture },
    { separator: true },
    { label: 'Выделение', shortcut: shortcuts.select, checked: tool === 'select', action: () => onSetTool('select') },
    { label: 'Карандаш', shortcut: shortcuts.brush, checked: tool === 'brush', action: () => onSetTool('brush') },
    { label: 'Ластик', shortcut: shortcuts.eraser, checked: tool === 'eraser', action: () => onSetTool('eraser') },
    { label: 'Заливка', shortcut: shortcuts.fill, checked: tool === 'fill', action: () => onSetTool('fill') },
    { label: 'Пипетка', shortcut: shortcuts.eyedropper, checked: tool === 'eyedropper', action: () => onSetTool('eyedropper') },
    { separator: true },
    { label: 'Линия', shortcut: shortcuts.line, checked: tool === 'line', action: () => onSetTool('line') },
    { label: 'Прямоугольник', shortcut: shortcuts.rect, checked: tool === 'rect', action: () => onSetTool('rect') },
    { label: 'Эллипс', shortcut: shortcuts.ellipse, checked: tool === 'ellipse', action: () => onSetTool('ellipse') },
    { separator: true },
    { label: showGrid ? 'Скрыть сетку пикселей' : 'Показать сетку пикселей', shortcut: shortcuts.toggleGrid, checked: showGrid, action: onToggleGrid },
    { label: showUv ? 'Скрыть UV-шаблон' : 'Показать UV-шаблон', shortcut: shortcuts.toggleUv, checked: showUv, action: onToggleUv },
    { separator: true },
    { label: 'Масштаб по умолчанию', action: onZoomReset },
  ]

  const finishPointer = (commit: boolean) => {
    onStrokeEnd()
    const drag = dragRef.current
    dragRef.current = null
    const pendingRight = rightPressRef.current
    const dragged = rightDragRef.current
    const menuAlreadyShown = menuOpenedByPressRef.current
    const at = lastClientRef.current
    // Some browsers dispatch `contextmenu` on release rather than on press; swallow it
    // after a background-color stroke so the menu cannot pop up over the drawing.
    if (dragged) suppressContextMenuRef.current = true
    resetPressState()
    setDraftShape(null)
    setDraftSelection(null)

    if (drag?.kind === 'transform') {
      setHoverHandle(null)
      if (commit) onTransformCommit(drag.rect)
      else onTransformCancel()
      return
    }
    if (drag?.kind === 'select') {
      if (commit) {
        const rect = normalizeRect(drag.anchor[0], drag.anchor[1], drag.current[0], drag.current[1])
        const area = (rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1)
        onSelectionChange(area > 1 ? rect : null)
      }
      return
    }
    if (drag?.kind === 'shape') {
      if (commit) onDrawShape(drag.shape, drag.color)
      return
    }
    if (pendingRight && !dragged && !menuAlreadyShown && at) {
      openContextMenuAt(at.x, at.y, buildCanvasMenu())
      suppressContextMenuRef.current = true
    }
  }

  const handlePointerUp = () => finishPointer(true)
  const handlePointerCancel = () => finishPointer(false)

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (suppressContextMenuRef.current) {
      suppressContextMenuRef.current = false
      return
    }
    if (rightPressRef.current && (tool === 'brush' || tool === 'eraser')) {
      // Deferred to pointerup: this press may still turn into a background-color stroke.
      return
    }
    menuOpenedByPressRef.current = true
    openContextMenu(event, buildCanvasMenu())
  }

  return (
    <div className="canvas-scroller" ref={scrollerRef}>
      <div className="canvas-stage">
        <div
          ref={wrapperRef}
          className="pixel-canvas-wrap"
          style={{
            width: TEXTURE_WIDTH * zoom,
            height: TEXTURE_HEIGHT * zoom,
            backgroundSize: `${zoom * 16}px ${zoom * 16}px`,
            backgroundPosition: '0 0',
          }}
          title="Колесо мыши — масштабирование"
          onContextMenu={handleContextMenu}
        >
          <canvas
            ref={canvasRef}
            width={TEXTURE_WIDTH}
            height={TEXTURE_HEIGHT}
            className={`pixel-canvas tool-${tool}`}
            aria-label="64 by 32 pixel texture canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => { setHoverPixel(null); setPointer(null); setHoverHandle(null) }}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handlePointerCancel}
          />
          {showGrid && (
            <svg className="pixel-grid-overlay" viewBox="0 0 64 32" preserveAspectRatio="none" aria-hidden="true">
              <path
                d={Array.from({ length: TEXTURE_WIDTH + 1 }, (_, x) => `M ${x} 0 V ${TEXTURE_HEIGHT}`).join(' ') + ' ' + Array.from({ length: TEXTURE_HEIGHT + 1 }, (_, y) => `M 0 ${y} H ${TEXTURE_WIDTH}`).join(' ')}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {showUv && (
            <svg className="uv-overlay" viewBox="0 0 64 32" preserveAspectRatio="none" aria-hidden="true">
              {uvFaces.map((face, index) => (
                <g key={face.name + index}>
                  <rect x={face.x} y={face.y} width={face.w} height={face.h} className="uv-face" />
                  {face.w >= 8 && face.h >= 8 && (
                    <text x={face.x + face.w / 2} y={face.y + face.h / 2} className="uv-label" textAnchor="middle" dominantBaseline="middle">{face.name}</text>
                  )}
                </g>
              ))}
              <rect x="22" y="0" width="26" height="22" className="uv-bounds" />
            </svg>
          )}
          {visibleSelection && (
            <svg className="selection-overlay" viewBox="0 0 64 32" preserveAspectRatio="none" aria-hidden="true">
              <rect
                className="selection-fill"
                x={visibleSelection.x0}
                y={visibleSelection.y0}
                width={visibleSelection.x1 - visibleSelection.x0 + 1}
                height={visibleSelection.y1 - visibleSelection.y0 + 1}
              />
              <rect
                className="selection-marquee-shadow"
                x={visibleSelection.x0}
                y={visibleSelection.y0}
                width={visibleSelection.x1 - visibleSelection.x0 + 1}
                height={visibleSelection.y1 - visibleSelection.y0 + 1}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                className="selection-marquee"
                x={visibleSelection.x0}
                y={visibleSelection.y0}
                width={visibleSelection.x1 - visibleSelection.x0 + 1}
                height={visibleSelection.y1 - visibleSelection.y0 + 1}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {tool === 'select' && activeTransform && (
            <div className="selection-handles" aria-hidden="true">
              {HANDLE_IDS.map((id) => {
                const [hx, hy] = handlePoint(activeTransform, id)
                return (
                  <span
                    key={id}
                    className={`selection-handle selection-handle-${id} ${hoverHandle === id ? 'selection-handle-active' : ''}`}
                    style={{ left: hx * zoom, top: hy * zoom }}
                  />
                )
              })}
            </div>
          )}
          {draftShape && (
            <svg className="shape-preview" viewBox="0 0 64 32" preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">
              {shapePoints(draftShape)
                .filter(([x, y]) => containsPoint(selection, x, y))
                .map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />)}
            </svg>
          )}
          {hoverPixel && (
            <div
              className={`pixel-cursor-preview ${tool === 'eraser' ? 'pixel-cursor-eraser' : ''} ${filledPreview && previewColor === transparentPixel ? 'pixel-cursor-transparent' : ''} ${filledPreview ? '' : 'pixel-cursor-cell'}`}
              style={{
                left: hoverPixel[0] * zoom,
                top: hoverPixel[1] * zoom,
                width: zoom,
                height: zoom,
                backgroundColor: filledPreview && previewColor !== transparentPixel ? previewColor : 'transparent',
              }}
              title={`${tool === 'select' || tool === 'line' || tool === 'rect' || tool === 'ellipse' ? 'Пиксель' : tool === 'eyedropper' ? 'Возьмёт' : tool === 'fill' ? 'Зальёт' : tool === 'eraser' ? 'Сотрёт' : 'Поставит'} ${hoverPixel[0]}, ${hoverPixel[1]} · ${tool === 'eraser' || tool === 'eyedropper' ? oldHoverColor : previewColor}`}
              aria-hidden="true"
            />
          )}
          {pointer && <div className="pixel-cursor" style={{ left: pointer.x, top: pointer.y }} aria-hidden="true" />}
        </div>
      </div>
      <div className="canvas-footnote">
        <span>64 × 32 px</span>
        <span>UV: 22, 0 → 48, 22</span>
        <span>Колесо — масштаб · {zoom * 100}%</span>
      </div>
    </div>
  )
}
