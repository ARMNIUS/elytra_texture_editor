export type Point = [number, number]

/** Inclusive pixel rectangle: x0 <= x1, y0 <= y1. */
export type SelectionRect = { x0: number; y0: number; x1: number; y1: number }

export type ShapeKind = 'line' | 'rect' | 'ellipse'
export type Shape = { kind: ShapeKind; x0: number; y0: number; x1: number; y1: number }

export function normalizeRect(x0: number, y0: number, x1: number, y1: number): SelectionRect {
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
  }
}

export function clampRect(rect: SelectionRect, width: number, height: number): SelectionRect | null {
  const x0 = Math.max(0, Math.min(width - 1, rect.x0))
  const y0 = Math.max(0, Math.min(height - 1, rect.y0))
  const x1 = Math.max(0, Math.min(width - 1, rect.x1))
  const y1 = Math.max(0, Math.min(height - 1, rect.y1))
  if (x0 > x1 || y0 > y1) return null
  return { x0, y0, x1, y1 }
}

export function containsPoint(rect: SelectionRect | null | undefined, x: number, y: number): boolean {
  if (!rect) return true
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1
}

export function rectWidth(rect: SelectionRect): number {
  return rect.x1 - rect.x0 + 1
}

export function rectHeight(rect: SelectionRect): number {
  return rect.y1 - rect.y0 + 1
}

/** Bresenham line, both endpoints inclusive. */
export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = []
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  while (true) {
    points.push([x, y])
    if (x === x1 && y === y1) break
    const twice = 2 * error
    if (twice >= dy) { error += dy; x += sx }
    if (twice <= dx) { error += dx; y += sy }
  }
  return points
}

export function rectOutlinePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const rect = normalizeRect(x0, y0, x1, y1)
  const points: Point[] = []
  const seen = new Set<string>()
  const push = (x: number, y: number) => {
    const key = `${x},${y}`
    if (seen.has(key)) return
    seen.add(key)
    points.push([x, y])
  }
  for (let x = rect.x0; x <= rect.x1; x++) {
    push(x, rect.y0)
    push(x, rect.y1)
  }
  for (let y = rect.y0; y <= rect.y1; y++) {
    push(rect.x0, y)
    push(rect.x1, y)
  }
  return points
}

/** One-pixel ellipse outline computed from an inside/outside mask. */
export function ellipseOutlinePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const rect = normalizeRect(x0, y0, x1, y1)
  const centerX = (rect.x0 + rect.x1) / 2
  const centerY = (rect.y0 + rect.y1) / 2
  const radiusX = Math.max(0.5, (rect.x1 - rect.x0) / 2)
  const radiusY = Math.max(0.5, (rect.y1 - rect.y0) / 2)
  const inside = (x: number, y: number) => {
    const nx = (x - centerX) / radiusX
    const ny = (y - centerY) / radiusY
    return nx * nx + ny * ny <= 1.0001
  }
  const points: Point[] = []
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (!inside(x, y)) continue
      const edge = x === rect.x0 || x === rect.x1 || y === rect.y0 || y === rect.y1
        || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      if (edge) points.push([x, y])
    }
  }
  return points
}

export function shapePoints(shape: Shape): Point[] {
  switch (shape.kind) {
    case 'line': return linePoints(shape.x0, shape.y0, shape.x1, shape.y1)
    case 'rect': return rectOutlinePoints(shape.x0, shape.y0, shape.x1, shape.y1)
    case 'ellipse': return ellipseOutlinePoints(shape.x0, shape.y0, shape.x1, shape.y1)
  }
}
