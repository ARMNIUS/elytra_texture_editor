import { useEffect, useRef } from 'react'
import {
  AmbientLight, Box3, Box3Helper, Color, DirectionalLight, GridHelper, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LineBasicMaterial } from 'three'
import type { LoadedModel } from './modelLoader'

type Props = {
  model: LoadedModel
  textureUrl?: string
  autoRotate: boolean
  visible: boolean
  showGrid: boolean
  showBounds: boolean
}

/** Generic Three.js viewport for imported Blockbench/Bedrock models. */
export default function ModelPreview({ model, textureUrl, autoRotate, visible, showGrid, showBounds }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const boxRef = useRef<Box3 | null>(null)
  const sizeRef = useRef<Vector3 | null>(null)
  const centerRef = useRef<Vector3 | null>(null)
  const textureRef = useRef(textureUrl)

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
    const helpers: Array<GridHelper | Box3Helper> = []
    if (showGrid) {
      const footprint = Math.max(size.x, size.z, 1) * 2
      const grid = new GridHelper(footprint, 16, 0x7291ad, 0x3a4a5a)
      grid.position.set(center.x, box.min.y, center.z)
      const gridMaterial = grid.material as LineBasicMaterial
      gridMaterial.transparent = true
      gridMaterial.opacity = 0.55
      gridMaterial.depthWrite = false
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
  }, [showGrid, showBounds, model])

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
