import { transparentPixel } from '../data/palettes'
import { parseRgba } from './color'
import { clampRect, containsPoint } from './shapes'
import type { Point, SelectionRect } from './shapes'

export const TEXTURE_WIDTH = 64
export const TEXTURE_HEIGHT = 32

export function pixelIndex(x: number, y: number): number {
  return y * TEXTURE_WIDTH + x
}

export function createTextureCanvas(pixels: string[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_WIDTH
  canvas.height = TEXTURE_HEIGHT
  const context = canvas.getContext('2d')!
  context.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < TEXTURE_HEIGHT; y++) {
    for (let x = 0; x < TEXTURE_WIDTH; x++) {
      const color = pixels[pixelIndex(x, y)] ?? transparentPixel
      if (color !== transparentPixel && !(color.length === 9 && color.endsWith('00'))) {
        context.fillStyle = color
        context.fillRect(x, y, 1, 1)
      }
    }
  }
  return canvas
}

export function pixelsToPngBlob(pixels: string[]): Promise<Blob> {
  const canvas = createTextureCanvas(pixels)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Не удалось закодировать PNG'))
    }, 'image/png')
  })
}

export function exportPixelsAsPng(pixels: string[], filename = 'elytra-texture.png'): void {
  const canvas = createTextureCanvas(pixels)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    // Revoking synchronously can cancel the download in some WebView2 builds.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

export type ImportedTexture = {
  pixels: string[]
  width: number
  height: number
}

export async function readImageFile(file: File): Promise<ImportedTexture> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = TEXTURE_WIDTH
    canvas.height = TEXTURE_HEIGHT
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = false
    context.drawImage(image, 0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
    const imageData = context.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT).data
    const result: string[] = []
    for (let i = 0; i < imageData.length; i += 4) {
      const [r, g, b, a] = [imageData[i], imageData[i + 1], imageData[i + 2], imageData[i + 3]]
      result.push(a === 0 ? transparentPixel : `#${[r, g, b, ...(a < 255 ? [a] : [])].map(v => v.toString(16).padStart(2, '0')).join('')}`)
    }
    return { pixels: result, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function floodFill(pixels: string[], startX: number, startY: number, replacement: string, bounds?: SelectionRect | null): string[] {
  if (startX < 0 || startX >= TEXTURE_WIDTH || startY < 0 || startY >= TEXTURE_HEIGHT) return pixels
  if (!containsPoint(bounds, startX, startY)) return pixels
  const startIndex = pixelIndex(startX, startY)
  const target = pixels[startIndex]
  if (target === replacement) return pixels
  const next = [...pixels]
  const stack: Point[] = [[startX, startY]]
  const visited = new Uint8Array(TEXTURE_WIDTH * TEXTURE_HEIGHT)
  while (stack.length) {
    const [x, y] = stack.pop()!
    if (x < 0 || x >= TEXTURE_WIDTH || y < 0 || y >= TEXTURE_HEIGHT) continue
    if (!containsPoint(bounds, x, y)) continue
    const index = pixelIndex(x, y)
    if (visited[index] || next[index] !== target) continue
    visited[index] = 1
    next[index] = replacement
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return next
}

/** Applies a color to every point, clipped to the canvas and the active selection. */
export function paintPoints(pixels: string[], points: Point[], color: string, bounds?: SelectionRect | null): string[] {
  let changed = false
  const next = [...pixels]
  for (const [x, y] of points) {
    if (x < 0 || x >= TEXTURE_WIDTH || y < 0 || y >= TEXTURE_HEIGHT) continue
    if (!containsPoint(bounds, x, y)) continue
    const index = pixelIndex(x, y)
    if (next[index] === color) continue
    next[index] = color
    changed = true
  }
  return changed ? next : pixels
}

export type PixelRegion = { width: number; height: number; pixels: string[] }

export function copyRegion(pixels: string[], rect: SelectionRect): PixelRegion | null {
  const clamped = clampRect(rect, TEXTURE_WIDTH, TEXTURE_HEIGHT)
  if (!clamped) return null
  const width = clamped.x1 - clamped.x0 + 1
  const height = clamped.y1 - clamped.y0 + 1
  const region: string[] = []
  for (let y = clamped.y0; y <= clamped.y1; y++) {
    for (let x = clamped.x0; x <= clamped.x1; x++) {
      region.push(pixels[pixelIndex(x, y)] ?? transparentPixel)
    }
  }
  return { width, height, pixels: region }
}

/** Composites a region onto the layer at (x, y); transparent pixels leave what is below. */
export function pasteRegion(pixels: string[], region: PixelRegion, x: number, y: number, bounds?: SelectionRect | null): string[] {
  let changed = false
  const next = [...pixels]
  for (let row = 0; row < region.height; row++) {
    for (let column = 0; column < region.width; column++) {
      const targetX = x + column
      const targetY = y + row
      if (targetX < 0 || targetX >= TEXTURE_WIDTH || targetY < 0 || targetY >= TEXTURE_HEIGHT) continue
      if (!containsPoint(bounds, targetX, targetY)) continue
      const source = region.pixels[row * region.width + column]
      if (!source || parseRgba(source).a === 0) continue
      const index = pixelIndex(targetX, targetY)
      if (next[index] === source) continue
      next[index] = source
      changed = true
    }
  }
  return changed ? next : pixels
}

export function clearRegion(pixels: string[], rect: SelectionRect): string[] {
  const clamped = clampRect(rect, TEXTURE_WIDTH, TEXTURE_HEIGHT)
  if (!clamped) return pixels
  let changed = false
  const next = [...pixels]
  for (let y = clamped.y0; y <= clamped.y1; y++) {
    for (let x = clamped.x0; x <= clamped.x1; x++) {
      const index = pixelIndex(x, y)
      if (next[index] === transparentPixel) continue
      next[index] = transparentPixel
      changed = true
    }
  }
  return changed ? next : pixels
}
