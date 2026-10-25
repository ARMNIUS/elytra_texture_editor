import React from 'react'
import { useEffect, useRef } from 'react'
import * as skinview3d from 'skinview3d'
import { BufferGeometry, EdgesGeometry, LineBasicMaterial, LineSegments, Mesh, Raycaster, Vector2 } from 'three'
import { Paintbrush, Grid2X2, ScanLine, PersonStanding, RotateCw } from 'lucide-react'
import { useContextMenu } from '@rawsprite/editor-ui/ContextMenu'
import { createTextureCanvas, pixelIndex } from '@rawsprite/core/texture'
import { makeUvGridGeometry } from './uvGrid'
import { transparentPixel } from '@rawsprite/core/palettes'
import defaultSkinUrl from './assets/steve.png'
import type { ToolId } from '@rawsprite/editor-ui/types'

type Props = {
  pixels: string[]
  width: number
  height: number
  visible: boolean
  autoRotate: boolean
  skinUrl: string | null
  tool: ToolId
  color: string
  showGrid: boolean
  showBounds: boolean
  paintEnabled: boolean
  crouching: boolean
  onPaintLine: (x0: number, y0: number, x1: number, y1: number, color: string) => void
  onFill: (x: number, y: number, color?: string) => void
  onStrokeStart: () => void
  onStrokeEnd: () => void
  onPick: (color: string) => void
  onNotice?: (message: string) => void
  onTogglePaint: () => void
  onToggleGrid: () => void
  onToggleBounds: () => void
  onToggleCrouch: () => void
  onToggleAutoRotate: () => void
}

export default function ElytraViewer({
  pixels, width, height, visible, autoRotate, skinUrl, tool, color, showGrid, showBounds, paintEnabled, crouching,
  onPaintLine, onFill, onStrokeStart, onStrokeEnd, onPick, onNotice, onTogglePaint, onToggleGrid, onToggleBounds, onToggleCrouch, onToggleAutoRotate,
}: Props) {
  const { openContextMenu, openContextMenuAt } = useContextMenu()
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null)
  const wingMeshesRef = useRef<Mesh[]>([])
  const edgeLinesRef = useRef<LineSegments[]>([])
  const gridLinesRef = useRef<LineSegments[]>([])
  const strokeRef = useRef<{ lastPixel: [number, number] | null; color: string; painting: boolean }>({ lastPixel: null, color, painting: false })
  const rightPressRef = useRef<{ pixel: [number, number]; clientX: number; clientY: number } | null>(null)
  const rightDragRef = useRef(false)
  const suppressContextMenuRef = useRef(false)
  const menuOpenedByPressRef = useRef(false)
  const initialSkinAppliedRef = useRef(true)
  const interactionRef = useRef({ pixels, width, height, tool, color, paintEnabled, showGrid, showBounds, crouching, autoRotate, onPaintLine, onFill, onStrokeStart, onStrokeEnd, onPick, onTogglePaint, onToggleGrid, onToggleBounds, onToggleCrouch, onToggleAutoRotate })
  interactionRef.current = { pixels, width, height, tool, color, paintEnabled, showGrid, showBounds, crouching, autoRotate, onPaintLine, onFill, onStrokeStart, onStrokeEnd, onPick, onTogglePaint, onToggleGrid, onToggleBounds, onToggleCrouch, onToggleAutoRotate }

  useEffect(() => {
    if (!canvasRef.current || !hostRef.current) return
    const canvas = canvasRef.current
    const viewer = new skinview3d.SkinViewer({
      canvas,
      width: Math.max(hostRef.current.clientWidth, 320),
      height: Math.max(hostRef.current.clientHeight, 320),
      skin: defaultSkinUrl,
      enableControls: true,
    })
    viewer.background = 0x202329
    viewer.autoRotate = false
    viewer.controls.enablePan = false
    viewer.controls.enableRotate = true
    viewer.controls.enableZoom = true
    viewer.zoom = 0.72
    viewerRef.current = viewer

    const wingMeshes: Mesh[] = []
    viewer.playerObject.elytra.traverse((object) => {
      if (object instanceof Mesh) wingMeshes.push(object)
    })
    const edgeLines: LineSegments[] = []
    const gridLines: LineSegments[] = []
    for (const object of wingMeshes) {
      const edgeMaterial = new LineBasicMaterial({ color: 0xd9e8fa, transparent: true, opacity: 0.86, depthTest: false })
      const edgeLinesGeometry = new EdgesGeometry(object.geometry as BufferGeometry, 1)
      const line = new LineSegments(edgeLinesGeometry, edgeMaterial)
      line.name = 'mts-model-boundaries'
      line.renderOrder = 6
      object.add(line)
      edgeLines.push(line)

      const gridMaterial = new LineBasicMaterial({
        // Thin, semi-transparent pixel grid that reads on both the light and dark wing panels.
        color: 0xeaf4ff, transparent: true, opacity: 0.38,
        depthTest: true, depthWrite: false, toneMapped: false,
      })
      const gridGeometry = makeUvGridGeometry(object.geometry as BufferGeometry, 0.008, width, height)
      const gridLine = new LineSegments(gridGeometry, gridMaterial)
      gridLine.name = 'mts-pixel-grid-lines'
      // The lines are generated in this mesh's local coordinate space, then
      // attached as a child so they follow the exact wing transforms.
      gridLine.renderOrder = 8
      gridLine.visible = interactionRef.current.showGrid
      object.add(gridLine)
      gridLines.push(gridLine)
    }
    wingMeshesRef.current = wingMeshes
    edgeLinesRef.current = edgeLines
    // The toggle effect iterates this ref; forgetting to assign it made the 3D grid
    // switch appear to do nothing.
    gridLinesRef.current = gridLines

    const observer = new ResizeObserver(() => {
      const width = hostRef.current?.clientWidth ?? 0
      const height = hostRef.current?.clientHeight ?? 0
      if (width > 0 && height > 0) {
        viewer.width = width
        viewer.height = height
      }
    })
    observer.observe(hostRef.current)

    return () => {
      observer.disconnect()
      gridLines.forEach((line) => {
        line.parent?.remove(line)
        line.geometry.dispose()
        const material = line.material
        if (Array.isArray(material)) material.forEach((item) => item.dispose())
        else material.dispose()
      })
      edgeLines.forEach((line) => {
        line.parent?.remove(line)
        line.geometry.dispose()
        const material = line.material
        if (Array.isArray(material)) material.forEach((item) => item.dispose())
        else material.dispose()
      })
      viewer.dispose()
      viewerRef.current = null
      wingMeshesRef.current = []
      edgeLinesRef.current = []
      gridLinesRef.current = []
    }
  }, [])

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.autoRotate = autoRotate
  }, [autoRotate])

  useEffect(() => {
    edgeLinesRef.current.forEach((line) => { line.visible = showBounds })
  }, [showBounds])

  useEffect(() => {
    gridLinesRef.current.forEach((line) => { line.visible = showGrid })
    viewerRef.current?.render()
  }, [showGrid])

  useEffect(() => {
    if (!visible) return
    const viewer = viewerRef.current
    const host = hostRef.current
    if (!viewer || !host) return
    const frame = window.requestAnimationFrame(() => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (width > 0 && height > 0) {
        viewer.width = width
        viewer.height = height
        viewer.render()
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [visible])

  useEffect(() => {
    // The viewer is constructed with the neutral skin, so the first run of this
    // effect would only reload an identical texture.
    if (initialSkinAppliedRef.current) {
      initialSkinAppliedRef.current = false
      return
    }
    const viewer = viewerRef.current
    if (!viewer) return
    const skin = skinUrl || defaultSkinUrl
    viewer.loadSkin(skin).catch((error: unknown) => {
      console.error('Could not load player skin:', error)
      onNotice?.('Не удалось загрузить скин модели')
    })
  }, [skinUrl, onNotice])

  useEffect(() => {
    // skinview3d accepts only the 64×32 cape/elytra atlas. Arbitrary RawSprite
    // documents are 2D-only for now; the Minecraft plugin will own 3D later.
    if (width !== 64 || height !== 32) return
    const viewer = viewerRef.current
    if (!viewer) return
    // Canvas sources are handled synchronously by skinview3d; no data-URL conversion or delayed races.
    viewer.loadCape(createTextureCanvas(pixels, width, height), { backEquipment: 'elytra' })
  }, [pixels, width, height])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (crouching) {
      const crouch = new skinview3d.CrouchAnimation()
      // Setting the animation resets the player and its progress, so assign it first.
      viewer.animation = crouch
      // One manual update places the model at the first fully crouched pose.
      // Keep speed=1 during the calculation: speed=0 would divide by zero inside CrouchAnimation.
      crouch.progress = 0.125
      crouch.speed = 1
      crouch.update(viewer.playerObject, 0)
      crouch.paused = true
      // Match the wing angles skinview3d's CrouchAnimation reaches in its fully
      // crouched frame (0.72 rad outward + 0.30 rad spread), which follows the
      // in-game crouch silhouette much closer than the old 0.40 rad pose.
      viewer.playerObject.elytra.resetJoints()
      viewer.playerObject.elytra.leftWing.rotation.z = 0.72
      viewer.playerObject.elytra.leftWing.rotation.y = 0.30
      viewer.playerObject.elytra.leftWing.rotation.x = 0.2617994
      viewer.playerObject.elytra.updateRightWing()
      // Lower the whole elytra rig slightly so the crouched wings sit behind
      // the shoulders instead of clipping into the back of the head.
      viewer.playerObject.elytra.position.y -= 1.6
      viewer.render()
    } else {
      viewer.animation = null
      viewer.playerObject.resetJoints()
      viewer.render()
    }
  }, [crouching])

  useEffect(() => {
    const canvas = canvasRef.current
    const viewer = viewerRef.current
    if (!canvas || !viewer) return
    const raycaster = new Raycaster()
    const pointer = new Vector2()

    const hitPixel = (event: PointerEvent): [number, number] | null => {
      const current = interactionRef.current
      if (current.width !== 64 || current.height !== 32) return null
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return null
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      viewer.playerObject.updateMatrixWorld(true)
      // skinview3d bundles its own Three version; the camera is structurally compatible.
      raycaster.setFromCamera(pointer, viewer.camera as unknown as Parameters<typeof raycaster.setFromCamera>[1])
      const hits = raycaster.intersectObjects(wingMeshesRef.current, false)
      const uv = hits.find((hit) => hit.uv)?.uv
      if (!uv) return null
      // skinview3d's Minecraft UV helper uses a bottom-left Three.js UV origin and a top-left image origin.
      const x = Math.min(current.width - 1, Math.max(0, Math.floor(uv.x * current.width)))
      const y = Math.min(current.height - 1, Math.max(0, Math.floor((1 - uv.y) * current.height)))
      return [x, y]
    }

    const buildViewerMenu = () => {
      const current = interactionRef.current
      return [
        { label: current.paintEnabled ? 'Отключить рисование по модели' : 'Рисовать по модели', icon: <Paintbrush size={13} />, checked: current.paintEnabled, action: current.onTogglePaint },
        { label: current.showGrid ? 'Скрыть пиксельную сетку' : 'Показать пиксельную сетку', icon: <Grid2X2 size={13} />, checked: current.showGrid, action: current.onToggleGrid },
        { label: current.showBounds ? 'Скрыть границы геометрии' : 'Показать границы геометрии', icon: <ScanLine size={13} />, checked: current.showBounds, action: current.onToggleBounds },
        { separator: true },
        { label: current.crouching ? 'Убрать присяд' : 'Присяд и раскрытие элитр', icon: <PersonStanding size={13} />, checked: current.crouching, shortcut: 'Shift', action: current.onToggleCrouch },
        { label: current.autoRotate ? 'Остановить вращение' : 'Включить автовращение', icon: <RotateCw size={13} />, checked: current.autoRotate, action: current.onToggleAutoRotate },
      ]
    }

    const onPointerDown = (event: PointerEvent) => {
      const current = interactionRef.current
      // Selection and shape tools belong to the 2D atlas; on the model they would only
      // block camera orbiting, so the viewer keeps the four direct-paint tools.
      const paintTool = current.tool === 'brush' || current.tool === 'eraser' || current.tool === 'fill' || current.tool === 'eyedropper'
      if (!current.paintEnabled || !paintTool || (event.button !== 0 && event.button !== 2)) return
      const point = hitPixel(event)
      if (!point) return // A miss is reserved for camera orbit and the viewer context menu.
      event.preventDefault()
      event.stopImmediatePropagation()
      try { canvas.setPointerCapture(event.pointerId) } catch { /* capture can fail if the pointer was already released */ }
      // Every new press starts clean, so a stroke that ended off the canvas cannot
      // swallow the next context menu request.
      suppressContextMenuRef.current = false
      menuOpenedByPressRef.current = false
      // Painting must never orbit the camera, including the right-button press that
      // only turns into a paint stroke after the drag threshold.
      viewer.controls.enabled = false

      // A stationary right click opens the context menu. Right-drag paints with the background color.
      if (event.button === 2) {
        rightPressRef.current = { pixel: point, clientX: event.clientX, clientY: event.clientY }
        rightDragRef.current = false
        return
      }

      if (current.tool === 'eyedropper') {
        const value = current.pixels[pixelIndex(point[0], point[1], current.width)] ?? transparentPixel
        current.onPick(value)
        viewer.controls.enabled = true
        return
      }
      if (current.tool === 'fill') {
        current.onFill(point[0], point[1], current.color)
        viewer.controls.enabled = true
        return
      }
      const strokeColor = current.tool === 'eraser' ? transparentPixel : current.color
      strokeRef.current = { lastPixel: point, color: strokeColor, painting: true }
      current.onStrokeStart()
      current.onPaintLine(point[0], point[1], point[0], point[1], strokeColor)
    }

    const onPointerMove = (event: PointerEvent) => {
      const current = interactionRef.current
      const pendingRight = rightPressRef.current
      if (pendingRight && (event.buttons & 2) !== 0 && current.paintEnabled && (current.tool === 'brush' || current.tool === 'eraser')) {
        if (Math.hypot(event.clientX - pendingRight.clientX, event.clientY - pendingRight.clientY) > 3) {
          event.preventDefault()
          event.stopImmediatePropagation()
          rightDragRef.current = true
          viewer.controls.enabled = false
          const strokeColor = current.tool === 'eraser' ? transparentPixel : current.color
          strokeRef.current = { lastPixel: pendingRight.pixel, color: strokeColor, painting: true }
          current.onStrokeStart()
          current.onPaintLine(pendingRight.pixel[0], pendingRight.pixel[1], pendingRight.pixel[0], pendingRight.pixel[1], strokeColor)
          rightPressRef.current = null
        }
      }

      const stroke = strokeRef.current
      if (!stroke.painting) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const point = hitPixel(event)
      if (!point) { stroke.lastPixel = null; return }
      const previous = stroke.lastPixel
      if (previous && (previous[0] !== point[0] || previous[1] !== point[1])) {
        interactionRef.current.onPaintLine(previous[0], previous[1], point[0], point[1], stroke.color)
      }
      stroke.lastPixel = point
    }

    const finishStroke = (event: PointerEvent) => {
      interactionRef.current.onStrokeEnd()
      if (rightPressRef.current && event.button === 2 && !strokeRef.current.painting) {
        rightPressRef.current = null
        if (!menuOpenedByPressRef.current) {
          // Chromium fires `contextmenu` on press. Painting tools defer the menu until
          // the release proves the right click was stationary instead of a right-button stroke.
          openContextMenuAt(event.clientX, event.clientY, buildViewerMenu())
          suppressContextMenuRef.current = true
        }
        menuOpenedByPressRef.current = false
        viewer.controls.enabled = true
        return
      }
      if (!strokeRef.current.painting) {
        // The pointer was cancelled or capture was lost before a stroke started.
        // Drop the pending right press and give camera control back, otherwise a
        // right-drag that never reaches the threshold would freeze the orbit.
        rightPressRef.current = null
        rightDragRef.current = false
        viewer.controls.enabled = true
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      if (rightDragRef.current) suppressContextMenuRef.current = true
      rightDragRef.current = false
      strokeRef.current = { lastPixel: null, color: interactionRef.current.color, painting: false }
      viewer.controls.enabled = true
    }
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (suppressContextMenuRef.current) {
        suppressContextMenuRef.current = false
        return
      }
      const current = interactionRef.current
      if (rightPressRef.current && current.paintEnabled && (current.tool === 'brush' || current.tool === 'eraser')) {
        return
      }
      menuOpenedByPressRef.current = true
      openContextMenu(event, buildViewerMenu())
    }

    canvas.addEventListener('pointerdown', onPointerDown, true)
    canvas.addEventListener('pointermove', onPointerMove, true)
    canvas.addEventListener('pointerup', finishStroke, true)
    canvas.addEventListener('pointercancel', finishStroke, true)
    canvas.addEventListener('lostpointercapture', finishStroke as EventListener, true)
    canvas.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true)
      canvas.removeEventListener('pointermove', onPointerMove, true)
      canvas.removeEventListener('pointerup', finishStroke, true)
      canvas.removeEventListener('pointercancel', finishStroke, true)
      canvas.removeEventListener('lostpointercapture', finishStroke as EventListener, true)
      canvas.removeEventListener('contextmenu', onContextMenu, true)
      viewer.controls.enabled = true
    }
  }, [])

  return (
    <div className={`viewer-host ${visible ? '' : 'viewer-host-hidden'}`} ref={hostRef}>
      <canvas ref={canvasRef} className={`viewer-canvas ${paintEnabled ? 'viewer-canvas-paint' : ''}`} />
      <div className="viewer-hint"><span className="live-dot" /> {paintEnabled ? (tool === 'brush' || tool === 'eraser' || tool === 'fill' || tool === 'eyedropper' ? 'Рисование по модели · ЛКМ / ПКМ — текущий цвет' : 'Инструмент доступен на 2D-развёртке · модель можно вращать') : '3D предпросмотр · перетаскивай для вращения'}</div>
      {crouching && <div className="viewer-pose-label">SHIFT · ПРИСЕД + РАСКРЫТЫЕ ЭЛИТРЫ</div>}
    </div>
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
