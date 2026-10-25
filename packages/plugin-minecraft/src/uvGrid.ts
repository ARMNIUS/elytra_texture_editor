import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { TEXTURE_HEIGHT, TEXTURE_WIDTH } from '@rawsprite/core/texture'

/**
 * Builds line geometry on a mesh surface from its UV atlas boundaries.
 *
 * Every pixel boundary is intersected with each triangle and emitted as a 3D line
 * segment, so the 3D pixel grid is real geometry that follows the wing surface
 * rather than a texture overlay. Segments are emitted on both sides of the surface
 * because the elytra wings are thin double-sided planes: depth testing then reveals
 * the copy facing the camera and hides the one behind the wing.
 */
export function makeUvGridGeometry(source: BufferGeometry, surfaceOffset = 0.008, width = TEXTURE_WIDTH, height = TEXTURE_HEIGHT): BufferGeometry {
  const position = source.getAttribute('position')
  const uv = source.getAttribute('uv')
  if (!position || !uv) return new BufferGeometry()
  const index = source.getIndex()
  const vertexCount = index ? index.count : position.count
  const out: number[] = []
  const epsilon = 1e-6

  // Most loaders normalize UVs to 0..1, but raw Blockbench/Bedrock geometry can
  // keep pixel coordinates. Detect that so the grid is not multiplied twice.
  let maxU = 0
  let maxV = 0
  for (let i = 0; i < uv.count; i++) {
    maxU = Math.max(maxU, uv.getX(i))
    maxV = Math.max(maxV, uv.getY(i))
  }
  const normalizedUv = maxU <= 1.0001 && maxV <= 1.0001
  const uScale = normalizedUv ? width : 1
  const vScale = normalizedUv ? height : 1

  const vertex = (i: number) => ({
    p: new Vector3().fromBufferAttribute(position, i),
    u: normalizedUv ? uv.getX(i) * uScale : uv.getX(i),
    v: normalizedUv ? (1 - uv.getY(i)) * vScale : uv.getY(i),
  })
  const addSegment = (a: Vector3, b: Vector3, normal: Vector3) => {
    for (const sign of [1, -1]) {
      const pa = a.clone().addScaledVector(normal, surfaceOffset * sign)
      const pb = b.clone().addScaledVector(normal, surfaceOffset * sign)
      out.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
    }
  }
  const intersectIsoLine = (verts: ReturnType<typeof vertex>[], axis: 'u' | 'v', value: number) => {
    const points: Vector3[] = []
    for (let edge = 0; edge < 3; edge++) {
      const a = verts[edge]
      const b = verts[(edge + 1) % 3]
      const av = a[axis]
      const bv = b[axis]
      if (Math.abs(av - bv) < epsilon) {
        if (Math.abs(value - av) < epsilon) {
          points.push(a.p.clone(), b.p.clone())
        }
        continue
      }
      const t = (value - av) / (bv - av)
      if (t >= -epsilon && t <= 1 + epsilon) {
        points.push(a.p.clone().lerp(b.p, Math.max(0, Math.min(1, t))))
      }
    }
    // Deduplicate intersections at triangle vertices.
    const unique: Vector3[] = []
    for (const point of points) {
      if (!unique.some((other) => other.distanceToSquared(point) < 1e-10)) unique.push(point)
    }
    if (unique.length >= 2) return [unique[0], unique[1]] as const
    return null
  }

  for (let triangle = 0; triangle < vertexCount; triangle += 3) {
    const ids = [0, 1, 2].map((offset) => index ? index.getX(triangle + offset) : triangle + offset)
    const verts = ids.map(vertex)
    const normal = verts[1].p.clone().sub(verts[0].p).cross(verts[2].p.clone().sub(verts[0].p)).normalize()
    if (normal.lengthSq() < epsilon) continue

    const minU = Math.max(0, Math.ceil(Math.min(...verts.map((item) => item.u)) - epsilon))
    const maxU = Math.min(width, Math.floor(Math.max(...verts.map((item) => item.u)) + epsilon))
    for (let u = minU; u <= maxU; u++) {
      const segment = intersectIsoLine(verts, 'u', u)
      if (segment && segment[0].distanceToSquared(segment[1]) > 1e-10) addSegment(segment[0], segment[1], normal)
    }

    const minV = Math.max(0, Math.ceil(Math.min(...verts.map((item) => item.v)) - epsilon))
    const maxV = Math.min(height, Math.floor(Math.max(...verts.map((item) => item.v)) + epsilon))
    for (let v = minV; v <= maxV; v++) {
      const segment = intersectIsoLine(verts, 'v', v)
      if (segment && segment[0].distanceToSquared(segment[1]) > 1e-10) addSegment(segment[0], segment[1], normal)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(out, 3))
  return geometry
}
