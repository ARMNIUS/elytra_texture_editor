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

/** Aseprite-compatible ellipse outline (Alois Zingl ellipse port, MIT). */
export function ellipseOutlinePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  let left = Math.min(x0, x1)
  let top = Math.min(y0, y1)
  let right = Math.max(x0, x1)
  let bottom = Math.max(y0, y1)

  if (left === right && top === bottom) return [[left, top]]
  if (left === right) {
    return Array.from({ length: bottom - top + 1 }, (_, index) => [left, top + index] as Point)
  }
  if (top === bottom) {
    return Array.from({ length: right - left + 1 }, (_, index) => [left + index, top] as Point)
  }

  let hPixels = 0
  let vPixels = 0
  const width = right - left + 1
  const height = bottom - top + 1
  let hDiameter = width - hPixels
  let vDiameter = height - vPixels

  if (width === 8 || width === 12 || width === 22) hPixels += 1
  if (height === 8 || height === 12 || height === 22) vPixels += 1
  hPixels = hDiameter > 5 ? hPixels : 0
  vPixels = vDiameter > 5 ? vPixels : 0
  if (hDiameter % 2 === 0 && hDiameter > 5) hPixels -= 1
  if (vDiameter % 2 === 0 && vDiameter > 5) vPixels -= 1
  right -= hPixels
  bottom -= vPixels

  // Keep these names aligned with the reference algorithm: they are mutated.
  let xStart = left
  let xEnd = right
  let yStart = top
  let yEnd = bottom
  const scanHeight = height

  let a = Math.abs(xEnd - xStart)
  let b = Math.abs(yEnd - yStart)
  const oddHeight = b & 1
  let dx = 4 * (1 - a) * b * b
  let dy = 4 * (oddHeight + 1) * a * a
  let error = dx + dy + oddHeight * a * a

  yStart += Math.floor((b + 1) / 2)
  yEnd = yStart - oddHeight
  a = 8 * a * a
  b = 8 * b * b

  const initialYStart = yStart
  const initialYEnd = yEnd
  const initialXStart = xStart
  const initialXEnd = xEnd + hPixels
  const points = new Set<string>()

  const plot = (x: number, y: number) => points.add(`${x}:${y}`)

  do {
    plot(xEnd + hPixels, yStart + vPixels)
    plot(xStart, yStart + vPixels)
    plot(xStart, yEnd)
    plot(xEnd + hPixels, yEnd)

    const e2 = 2 * error
    if (e2 <= dy) {
      yStart += 1
      yEnd -= 1
      dy += a
      error += dy
    }
    if (e2 >= dx || 2 * error > dy) {
      xStart += 1
      xEnd -= 1
      dx += b
      error += dx
    }
  } while (xStart <= xEnd)

  while (yStart + vPixels - yEnd + 1 <= scanHeight) {
    plot(xStart - 1, yStart + vPixels)
    plot(xEnd + 1 + hPixels, yStart + vPixels)
    yStart += 1
    plot(xStart - 1, yEnd)
    plot(xEnd + 1 + hPixels, yEnd)
    yEnd -= 1
  }

  if (hPixels > 0) {
    for (let x = xStart; x < xEnd + hPixels + 1; x += 1) {
      plot(x, yEnd + 1)
      plot(x, yStart + vPixels - 1)
    }
  }
  if (vPixels > 0) {
    for (let y = initialYEnd + 1; y < initialYStart + vPixels; y += 1) {
      plot(initialXStart, y)
      plot(initialXEnd, y)
    }
  }

  return [...points]
    .map((point) => point.split(':').map(Number) as Point)
    .sort((first, second) => first[1] - second[1] || first[0] - second[0])
}

export function shapePoints(shape: Shape): Point[] {
  switch (shape.kind) {
    case 'line': return linePoints(shape.x0, shape.y0, shape.x1, shape.y1)
    case 'rect': return rectOutlinePoints(shape.x0, shape.y0, shape.x1, shape.y1)
    case 'ellipse': return ellipseOutlinePoints(shape.x0, shape.y0, shape.x1, shape.y1)
  }
}
