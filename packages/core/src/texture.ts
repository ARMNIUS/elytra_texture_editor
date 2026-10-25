import { transparentPixel } from './palettes'
import { parseRgba } from './color'
import { clampRect, containsPoint } from './shapes'
import type { Point, SelectionRect } from './shapes'

/** Default atlas size for the legacy Minecraft documents. New code passes explicit dimensions. */
export const TEXTURE_WIDTH = 64
export const TEXTURE_HEIGHT = 32

export function pixelIndex(x: number, y: number, width = TEXTURE_WIDTH): number {
  return y * width + x
}

export function createTextureCanvas(
  pixels: string[],
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixels[pixelIndex(x, y, width)] ?? transparentPixel
      if (color !== transparentPixel && !(color.length === 9 && color.endsWith('00'))) {
        context.fillStyle = color
        context.fillRect(x, y, 1, 1)
      }
    }
  }
  return canvas
}

export function pixelsToPngBlob(
  pixels: string[],
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): Promise<Blob> {
  const canvas = createTextureCanvas(pixels, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Не удалось закодировать PNG'))
    }, 'image/png')
  })
}

export function exportPixelsAsPng(
  pixels: string[],
  filename = 'elytra-texture.png',
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): void {
  const canvas = createTextureCanvas(pixels, width, height)
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

export async function readImageFile(
  file: File,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): Promise<ImportedTexture> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = false
    context.drawImage(image, 0, 0, width, height)
    const imageData = context.getImageData(0, 0, width, height).data
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

export function floodFill(
  pixels: string[],
  startX: number,
  startY: number,
  replacement: string,
  bounds?: SelectionRect | null,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): string[] {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return pixels
  if (!containsPoint(bounds, startX, startY)) return pixels
  const startIndex = pixelIndex(startX, startY, width)
  const target = pixels[startIndex]
  if (target === replacement) return pixels
  const next = [...pixels]
  const stack: Point[] = [[startX, startY]]
  const visited = new Uint8Array(width * height)
  while (stack.length) {
    const [x, y] = stack.pop()!
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    if (!containsPoint(bounds, x, y)) continue
    const index = pixelIndex(x, y, width)
    if (visited[index] || next[index] !== target) continue
    visited[index] = 1
    next[index] = replacement
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
  return next
}

/** Applies a color to every point, clipped to the canvas and the active selection. */
export function paintPoints(
  pixels: string[],
  points: Point[],
  color: string,
  bounds?: SelectionRect | null,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): string[] {
  let changed = false
  const next = [...pixels]
  for (const [x, y] of points) {
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    if (!containsPoint(bounds, x, y)) continue
    const index = pixelIndex(x, y, width)
    if (next[index] === color) continue
    next[index] = color
    changed = true
  }
  return changed ? next : pixels
}

export type PixelRegion = { width: number; height: number; pixels: string[] }

export function copyRegion(
  pixels: string[],
  rect: SelectionRect,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): PixelRegion | null {
  const clamped = clampRect(rect, width, height)
  if (!clamped) return null
  const regionWidth = clamped.x1 - clamped.x0 + 1
  const regionHeight = clamped.y1 - clamped.y0 + 1
  const region: string[] = []
  for (let y = clamped.y0; y <= clamped.y1; y++) {
    for (let x = clamped.x0; x <= clamped.x1; x++) {
      region.push(pixels[pixelIndex(x, y, width)] ?? transparentPixel)
    }
  }
  return { width: regionWidth, height: regionHeight, pixels: region }
}

/** Composites a region onto the layer at (x, y); transparent pixels leave what is below. */
export function pasteRegion(
  pixels: string[],
  region: PixelRegion,
  x: number,
  y: number,
  bounds?: SelectionRect | null,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): string[] {
  let changed = false
  const next = [...pixels]
  for (let row = 0; row < region.height; row++) {
    for (let column = 0; column < region.width; column++) {
      const targetX = x + column
      const targetY = y + row
      if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue
      if (!containsPoint(bounds, targetX, targetY)) continue
      const source = region.pixels[row * region.width + column]
      if (!source || parseRgba(source).a === 0) continue
      const index = pixelIndex(targetX, targetY, width)
      if (next[index] === source) continue
      next[index] = source
      changed = true
    }
  }
  return changed ? next : pixels
}

export function clearRegion(
  pixels: string[],
  rect: SelectionRect,
  width = TEXTURE_WIDTH,
  height = TEXTURE_HEIGHT,
): string[] {
  const clamped = clampRect(rect, width, height)
  if (!clamped) return pixels
  let changed = false
  const next = [...pixels]
  for (let y = clamped.y0; y <= clamped.y1; y++) {
    for (let x = clamped.x0; x <= clamped.x1; x++) {
      const index = pixelIndex(x, y, width)
      if (next[index] === transparentPixel) continue
      next[index] = transparentPixel
      changed = true
    }
  }
  return changed ? next : pixels
}
