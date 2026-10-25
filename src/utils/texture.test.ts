import { describe, expect, it } from 'vitest'
import { transparentPixel } from '@rawsprite/core/palettes'
import { clearRegion, copyRegion, floodFill, paintPoints, pasteRegion, pixelIndex, placePixels, TEXTURE_HEIGHT, TEXTURE_WIDTH } from '@rawsprite/core/texture'

function blankTexture(): string[] {
  return Array.from({ length: TEXTURE_WIDTH * TEXTURE_HEIGHT }, () => transparentPixel)
}

function maskOf(pixels: string[], color: string): number[] {
  return pixels.reduce<number[]>((indices, pixel, index) => {
    if (pixel === color) indices.push(index)
    return indices
  }, [])
}

describe('pixelIndex', () => {
  it('maps an x/y pair to the row-major array position', () => {
    expect(pixelIndex(0, 0)).toBe(0)
    expect(pixelIndex(3, 2)).toBe(2 * TEXTURE_WIDTH + 3)
    expect(pixelIndex(TEXTURE_WIDTH - 1, TEXTURE_HEIGHT - 1)).toBe(TEXTURE_WIDTH * TEXTURE_HEIGHT - 1)
  })
})

describe('floodFill', () => {
  it('fills the connected region only', () => {
    const pixels = blankTexture()
    // Draw a vertical wall at x = 10 to separate the canvas into two regions.
    for (let y = 0; y < TEXTURE_HEIGHT; y++) pixels[pixelIndex(10, y)] = '#111111'
    const filled = floodFill(pixels, 0, 0, '#ff0000')
    expect(filled[pixelIndex(0, 0)]).toBe('#ff0000')
    expect(filled[pixelIndex(9, 5)]).toBe('#ff0000')
    expect(filled[pixelIndex(10, 5)]).toBe('#111111')
    expect(filled[pixelIndex(11, 5)]).toBe(transparentPixel)
    expect(maskOf(filled, '#ff0000')).toHaveLength(10 * TEXTURE_HEIGHT)
  })

  it('does not mutate the source texture', () => {
    const pixels = blankTexture()
    const filled = floodFill(pixels, 4, 4, '#00ff00')
    expect(pixels[pixelIndex(4, 4)]).toBe(transparentPixel)
    expect(filled).not.toBe(pixels)
  })

  it('returns the same array when the replacement matches the target', () => {
    const pixels = blankTexture()
    expect(floodFill(pixels, 0, 0, transparentPixel)).toBe(pixels)
  })

  it('fills a transparent region without touching painted pixels', () => {
    const pixels = blankTexture()
    pixels[pixelIndex(1, 1)] = '#abcdef'
    const filled = floodFill(pixels, 20, 20, '#000000')
    expect(filled[pixelIndex(1, 1)]).toBe('#abcdef')
    expect(filled[pixelIndex(20, 20)]).toBe('#000000')
    expect(maskOf(filled, '#000000')).toHaveLength(TEXTURE_WIDTH * TEXTURE_HEIGHT - 1)
  })

  it('ignores an out-of-bounds start without throwing', () => {
    const pixels = blankTexture()
    const result = floodFill(pixels, -3, -7, '#ffffff')
    expect(maskOf(result, '#ffffff')).toHaveLength(0)
  })

  it('stops at the bounds of the active selection', () => {
    const pixels = blankTexture()
    const filled = floodFill(pixels, 5, 5, '#0000ff', { x0: 0, y0: 0, x1: 7, y1: 7 })
    expect(maskOf(filled, '#0000ff')).toHaveLength(8 * 8)
    expect(filled[pixelIndex(8, 8)]).toBe(transparentPixel)
  })
})

describe('paintPoints', () => {
  it('clips points to the canvas and the selection', () => {
    const pixels = blankTexture()
    const painted = paintPoints(pixels, [[1, 1], [2, 2], [70, 70]], '#ff0000', { x0: 0, y0: 0, x1: 1, y1: 1 })
    expect(painted[pixelIndex(1, 1)]).toBe('#ff0000')
    expect(painted[pixelIndex(2, 2)]).toBe(transparentPixel)
  })

  it('returns the same array when nothing changes', () => {
    const pixels = blankTexture()
    expect(paintPoints(pixels, [[0, 0]], transparentPixel)).toBe(pixels)
    expect(paintPoints(pixels, [[-1, -1]], '#ff0000')).toBe(pixels)
  })
})

describe('selection regions', () => {
  it('copies, clears and pastes a rectangular region', () => {
    const pixels = blankTexture()
    pixels[pixelIndex(1, 1)] = '#123456'
    const region = copyRegion(pixels, { x0: 1, y0: 1, x1: 2, y1: 2 })
    expect(region).toEqual({ width: 2, height: 2, pixels: ['#123456', transparentPixel, transparentPixel, transparentPixel] })

    const cleared = clearRegion(pixels, { x0: 1, y0: 1, x1: 2, y1: 2 })
    expect(cleared[pixelIndex(1, 1)]).toBe(transparentPixel)

    const pasted = pasteRegion(cleared, region!, 10, 10)
    expect(pasted[pixelIndex(10, 10)]).toBe('#123456')
    expect(pasted[pixelIndex(11, 11)]).toBe(transparentPixel)
  })

  it('does not erase pixels under the transparent part of a pasted region', () => {
    const pixels = blankTexture()
    pixels[pixelIndex(5, 5)] = '#00ff00'
    const region = { width: 2, height: 1, pixels: [transparentPixel, '#ff0000'] }
    const pasted = pasteRegion(pixels, region, 5, 5)
    expect(pasted[pixelIndex(5, 5)]).toBe('#00ff00')
    expect(pasted[pixelIndex(6, 5)]).toBe('#ff0000')
  })

  it('clips a region that hangs off the canvas', () => {
    const pixels = blankTexture()
    const region = { width: 2, height: 2, pixels: ['#fff000', '#fff000', '#fff000', '#fff000'] }
    const pasted = pasteRegion(pixels, region, TEXTURE_WIDTH - 1, TEXTURE_HEIGHT - 1)
    expect(pasted[pixelIndex(TEXTURE_WIDTH - 1, TEXTURE_HEIGHT - 1)]).toBe('#fff000')
    expect(pasted.filter((pixel) => pixel === '#fff000')).toHaveLength(1)
  })

  it('paints and flood-fills a canvas with non-default dimensions', () => {
    const pixels = Array.from({ length: 4 * 3 }, () => transparentPixel)
    const painted = paintPoints(pixels, [[3, 2], [4, 2]], '#ff0000', null, 4, 3)
    expect(painted).toHaveLength(12)
    expect(painted[pixelIndex(3, 2, 4)]).toBe('#ff0000')
    expect(painted[pixelIndex(4, 2, 4)]).toBe(undefined)

    const filled = floodFill(pixels, 0, 0, '#00ff00', null, 4, 3)
    expect(filled.every((pixel) => pixel === '#00ff00')).toBe(true)
  })

  it('copies and pastes regions using explicit dimensions', () => {
    const pixels = Array.from({ length: 4 * 2 }, () => transparentPixel)
    pixels[1 * 4 + 2] = '#abcdef'
    const region = copyRegion(pixels, { x0: 2, y0: 1, x1: 3, y1: 1 }, 4, 2)
    expect(region).toEqual({ width: 2, height: 1, pixels: ['#abcdef', transparentPixel] })

    const pasted = pasteRegion(pixels, region!, 0, 0, null, 4, 2)
    expect(pasted[0]).toBe('#abcdef')
  })

  it('places an image at native size without stretching it across the canvas', () => {
    const source = ['#ff0000', '#00ff00', '#0000ff', '#ffffff']
    const placed = placePixels(source, 2, 2, 8, 8)
    expect(placed).toHaveLength(64)
    expect(placed[0]).toBe('#ff0000')
    expect(placed[1]).toBe('#00ff00')
    expect(placed[8]).toBe('#0000ff')
    expect(placed[9]).toBe('#ffffff')
    expect(placed[10]).toBe(transparentPixel)
    expect(placed[63]).toBe(transparentPixel)
  })

  it('clips an oversized image when placing it on a smaller canvas', () => {
    const source = Array.from({ length: 4 * 4 }, () => '#abcdef')
    const placed = placePixels(source, 4, 4, 2, 2)
    expect(placed).toHaveLength(4)
    expect(placed.every((pixel) => pixel === '#abcdef')).toBe(true)
  })
})
