import { transparentPixel } from '../data/palettes'
import { compositeRgba, formatRgba, parseRgba } from './color'
import type { SelectionRect } from './shapes'
import { TEXTURE_HEIGHT, TEXTURE_WIDTH } from './texture'

export type PixelBlock = { width: number; height: number; pixels: string[] }
export type TransformRect = { x: number; y: number; width: number; height: number }
export type TransformKind = 'rotateCW' | 'rotateCCW' | 'rotate180' | 'flipH' | 'flipV'

export function extractBlock(pixels: string[], rect: SelectionRect): PixelBlock {
  const width = rect.x1 - rect.x0 + 1
  const height = rect.y1 - rect.y0 + 1
  const block: string[] = []
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      block.push(pixels[y * TEXTURE_WIDTH + x] ?? transparentPixel)
    }
  }
  return { width, height, pixels: block }
}

/** Nearest-neighbour resize; pixel art must not be smoothed. */
export function scaleBlock(block: PixelBlock, width: number, height: number): PixelBlock {
  const targetWidth = Math.max(1, Math.round(width))
  const targetHeight = Math.max(1, Math.round(height))
  if (targetWidth === block.width && targetHeight === block.height) return block
  const pixels: string[] = []
  for (let y = 0; y < targetHeight; y++) {
    const sourceY = Math.min(block.height - 1, Math.floor((y * block.height) / targetHeight))
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.min(block.width - 1, Math.floor((x * block.width) / targetWidth))
      pixels.push(block.pixels[sourceY * block.width + sourceX] ?? transparentPixel)
    }
  }
  return { width: targetWidth, height: targetHeight, pixels }
}

export function rotateBlock(block: PixelBlock, quarterTurns: 1 | 2 | 3): PixelBlock {
  const { width, height, pixels } = block
  if (quarterTurns === 2) {
    const rotated: string[] = []
    for (let index = pixels.length - 1; index >= 0; index--) rotated.push(pixels[index])
    return { width, height, pixels: rotated }
  }
  const nextWidth = height
  const nextHeight = width
  const rotated = new Array<string>(pixels.length)
  for (let y = 0; y < nextHeight; y++) {
    for (let x = 0; x < nextWidth; x++) {
      const sourceX = quarterTurns === 1 ? y : width - 1 - y
      const sourceY = quarterTurns === 1 ? height - 1 - x : x
      rotated[y * nextWidth + x] = pixels[sourceY * width + sourceX] ?? transparentPixel
    }
  }
  return { width: nextWidth, height: nextHeight, pixels: rotated }
}

export function flipBlock(block: PixelBlock, axis: 'horizontal' | 'vertical'): PixelBlock {
  const { width, height, pixels } = block
  const flipped = new Array<string>(pixels.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceX = axis === 'horizontal' ? width - 1 - x : x
      const sourceY = axis === 'vertical' ? height - 1 - y : y
      flipped[y * width + x] = pixels[sourceY * width + sourceX] ?? transparentPixel
    }
  }
  return { width, height, pixels: flipped }
}

export function applyTransform(block: PixelBlock, kind: TransformKind): PixelBlock {
  switch (kind) {
    case 'rotateCW': return rotateBlock(block, 1)
    case 'rotateCCW': return rotateBlock(block, 3)
    case 'rotate180': return rotateBlock(block, 2)
    case 'flipH': return flipBlock(block, 'horizontal')
    case 'flipV': return flipBlock(block, 'vertical')
  }
}

/**
 * Draws a block at (x, y) with source-over compositing.
 * Fully transparent source pixels leave the target untouched, so moving art over
 * existing pixels behaves like a normal floating selection.
 */
export function blitBlock(target: string[], block: PixelBlock, x: number, y: number): string[] {
  const next = [...target]
  for (let row = 0; row < block.height; row++) {
    const targetY = y + row
    if (targetY < 0 || targetY >= TEXTURE_HEIGHT) continue
    for (let column = 0; column < block.width; column++) {
      const targetX = x + column
      if (targetX < 0 || targetX >= TEXTURE_WIDTH) continue
      const source = block.pixels[row * block.width + column]
      if (!source || source === transparentPixel) continue
      const sourceRgba = parseRgba(source)
      if (sourceRgba.a === 0) continue
      const index = targetY * TEXTURE_WIDTH + targetX
      if (sourceRgba.a === 255) {
        next[index] = formatRgba(sourceRgba)
        continue
      }
      next[index] = formatRgba(compositeRgba(parseRgba(next[index] ?? transparentPixel), sourceRgba))
    }
  }
  return next
}

/** Selection rectangle occupied by a block placed at (x, y), clamped to the 64×32 canvas. */
export function blockSelection(block: PixelBlock, x: number, y: number): SelectionRect | null {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(TEXTURE_WIDTH - 1, x + block.width - 1)
  const y1 = Math.min(TEXTURE_HEIGHT - 1, y + block.height - 1)
  if (x0 > x1 || y0 > y1) return null
  return { x0, y0, x1, y1 }
}
