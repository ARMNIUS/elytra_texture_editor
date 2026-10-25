import { useEffect, useRef } from 'react'
import {
  AmbientLight, Box3, Box3Helper, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, LineBasicMaterial, LineSegments, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { installModelGrid } from './modelGrid'
import type { ModelGridHandle } from './modelGrid'
import type { LoadedModel } from './modelLoader'

type Props = {
  model: LoadedModel
  textureUrl?: string
  autoRotate: boolean
  visible: boolean
  showGrid: boolean
  showBounds: boolean
  showFloorGrid?: boolean
  width: number
  height: number
}

/** Generic Three.js viewport for imported Blockbench/Bedrock models. */
export default function ModelPreview({ model, textureUrl, autoRotate, visible, showGrid, showBounds, showFloorGrid = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const boxRef = useRef<Box3 | null>(null)
  const sizeRef = useRef<Vector3 | null>(null)
  const centerRef = useRef<Vector3 | null>(null)
  const textureRef = useRef(textureUrl)
  const gridHandlesRef = useRef<ModelGridHandle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = 'srgb'

    const scene = new Scene()
    scene.background = new Color('#1d2025')
    const camera = new PerspectiveCamera(40, 1, 0.01, 2000)
    scene.add(new AmbientLight(0xffffff, 1.35))
    const key = new DirectionalLight(0xffffff, 1.8)
    key.position.set(4, 8, 6)
    scene.add(key)

    const object = model.object3D
    scene.add(object)

    const box = new Box3().setFromObject(object)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const extent = Math.max(size.x, size.y, size.z, 0.1)
    sceneRef.current = scene
    boxRef.current = box
    sizeRef.current = size.clone()
    centerRef.current = center.clone()
    camera.position.set(center.x + extent * 1.4, center.y + extent * 0.7, center.z + extent * 2.1)
    camera.lookAt(center)
    camera.near = extent / 200
    camera.far = extent * 50
    camera.updateProjectionMatrix()

    const controls = new OrbitControls(camera, canvas)
    controls.target.copy(center)
    controls.enableDamping = true
    controls.autoRotate = autoRotate
    controls.autoRotateSpeed = 1.2
    controls.update()
    controlsRef.current = controls

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      controlsRef.current = null
      scene.remove(object)
      sceneRef.current = null
      boxRef.current = null
      sizeRef.current = null
      centerRef.current = null
    }
  }, [model])

  useEffect(() => {
    const scene = sceneRef.current
    const box = boxRef.current
    const size = sizeRef.current
    const center = centerRef.current
    if (!scene || !box || !size || !center) return
    const helpers: Array<LineSegments | Box3Helper> = []
    if (showFloorGrid) {
      // A coordinate grid aligned to model pixels: one cell = one model pixel.
      const unit = model.unitScale
      const widthPixels = Math.max(1, Math.round(size.x / unit))
      const depthPixels = Math.max(1, Math.round(size.z / unit))
      const y = box.min.y - unit * 0.001
      const positions: number[] = []
      for (let x = 0; x <= widthPixels; x++) {
        const px = box.min.x + (size.x * x) / widthPixels
        positions.push(px, y, box.min.z, px, y, box.max.z)
      }
      for (let z = 0; z <= depthPixels; z++) {
        const pz = box.min.z + (size.z * z) / depthPixels
        positions.push(box.min.x, y, pz, box.max.x, y, pz)
      }
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      const gridMaterial = new LineBasicMaterial({
        color: 0x7291ad,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
      const grid = new LineSegments(geometry, gridMaterial)
      grid.name = 'rawsprite-model-pixel-grid'
      grid.renderOrder = 6
      scene.add(grid)
      helpers.push(grid)
    }
    if (showBounds) {
      const bounds = new Box3Helper(box, 0xffc44d)
      const boundsMaterial = bounds.material as LineBasicMaterial
      boundsMaterial.depthTest = false
      boundsMaterial.transparent = true
      boundsMaterial.opacity = 0.95
      bounds.renderOrder = 10
      scene.add(bounds)
      helpers.push(bounds)
    }
    return () => {
      for (const helper of helpers) {
        scene.remove(helper)
        helper.geometry.dispose()
        const materials = Array.isArray(helper.material) ? helper.material : [helper.material]
        for (const material of materials) material.dispose()
      }
    }
  }, [showFloorGrid, showBounds, model])

  useEffect(() => {
    const handles = model.materials.map((material) => installModelGrid(
      material,
      model.textureWidth,
      model.textureHeight,
      showGrid,
    ))
    gridHandlesRef.current = handles
    return () => {
      for (const handle of handles) handle.dispose()
      gridHandlesRef.current = []
    }
  }, [model])

  useEffect(() => {
    for (const handle of gridHandlesRef.current) handle.setVisible(showGrid)
  }, [showGrid, model])

  useEffect(() => {
    const controls = controlsRef.current
    if (controls) controls.autoRotate = autoRotate
  }, [autoRotate])

  useEffect(() => {
    if (!textureUrl || textureUrl === textureRef.current) return
    textureRef.current = textureUrl
    void model.updateTexture?.(textureUrl)
  }, [model, textureUrl])

  return (
    <div className={`model-preview-host ${visible ? '' : 'model-preview-hidden'}`}>
      <canvas ref={canvasRef} className="model-preview-canvas" />
    </div>
  )
}
