import { describe, expect, it } from 'vitest'
import { transparentPixel } from '../data/palettes'
import { applyTransform, blitBlock, blockSelection, extractBlock, flipBlock, rotateBlock, scaleBlock } from './transform'

const A = '#ff0000'
const B = '#00ff00'
const C = '#0000ff'
const D = '#ffff00'

function blockOf(width: number, height: number, pixels: string[]) {
  return { width, height, pixels }
}

describe('extractBlock', () => {
  it('reads a rectangular region in row-major order', () => {
    const pixels = Array.from({ length: 64 * 32 }, () => transparentPixel)
    pixels[1 * 64 + 2] = A
    pixels[2 * 64 + 3] = B
    const block = extractBlock(pixels, { x0: 2, y0: 1, x1: 3, y1: 2 })
    expect(block).toEqual({ width: 2, height: 2, pixels: [A, transparentPixel, transparentPixel, B] })
  })
})

describe('rotateBlock', () => {
  const row = blockOf(2, 1, [A, B])

  it('rotates clockwise', () => {
    expect(rotateBlock(row, 1)).toEqual(blockOf(1, 2, [A, B]))
  })

  it('rotates counter-clockwise', () => {
    expect(rotateBlock(row, 3)).toEqual(blockOf(1, 2, [B, A]))
  })

  it('rotates 180 degrees', () => {
    expect(rotateBlock(blockOf(2, 2, [A, B, C, D]), 2)).toEqual(blockOf(2, 2, [D, C, B, A]))
  })

  it('keeps all pixels when rotating a rectangle four times', () => {
    const original = blockOf(3, 2, [A, B, C, D, A, B])
    let rotated = original
    for (let turn = 0; turn < 4; turn++) rotated = rotateBlock(rotated, 1)
    expect(rotated).toEqual(original)
  })
})

describe('flipBlock', () => {
  it('flips horizontally and vertically', () => {
    const block = blockOf(2, 2, [A, B, C, D])
    expect(flipBlock(block, 'horizontal')).toEqual(blockOf(2, 2, [B, A, D, C]))
    expect(flipBlock(block, 'vertical')).toEqual(blockOf(2, 2, [C, D, A, B]))
  })
})

describe('applyTransform', () => {
  it('dispatches every transform kind', () => {
    const block = blockOf(2, 1, [A, B])
    expect(applyTransform(block, 'rotateCW')).toEqual(blockOf(1, 2, [A, B]))
    expect(applyTransform(block, 'rotateCCW')).toEqual(blockOf(1, 2, [B, A]))
    expect(applyTransform(block, 'flipH')).toEqual(blockOf(2, 1, [B, A]))
    expect(applyTransform(block, 'flipV')).toEqual(blockOf(2, 1, [A, B]))
  })
})

describe('scaleBlock', () => {
  it('stretches with nearest-neighbour sampling', () => {
    const block = blockOf(2, 1, [A, B])
    expect(scaleBlock(block, 4, 2)).toEqual(blockOf(4, 2, [A, A, B, B, A, A, B, B]))
  })

  it('returns the same block for unchanged dimensions', () => {
    const block = blockOf(2, 2, [A, B, C, D])
    expect(scaleBlock(block, 2, 2)).toBe(block)
  })

  it('never shrinks below one pixel', () => {
    expect(scaleBlock(blockOf(2, 2, [A, B, C, D]), 0, 0)).toEqual(blockOf(1, 1, [A]))
  })
})

describe('blitBlock', () => {
  it('draws opaque pixels and skips transparent ones', () => {
    const target = Array.from({ length: 64 * 32 }, () => transparentPixel)
    const block = blockOf(2, 1, [A, transparentPixel])
    const result = blitBlock(target, block, 1, 1)
    expect(result[1 * 64 + 1]).toBe(A)
    expect(result[1 * 64 + 2]).toBe(transparentPixel)
  })

  it('composites semi-transparent pixels over existing art', () => {
    const target = Array.from({ length: 64 * 32 }, () => A)
    const result = blitBlock(target, blockOf(1, 1, ['#00ff0080']), 0, 0)
    expect(result[0]).toBe('#7f8000')
  })

  it('clips a block that hangs off the canvas', () => {
    const target = Array.from({ length: 64 * 32 }, () => transparentPixel)
    const result = blitBlock(target, blockOf(2, 2, [A, A, A, A]), 63, 31)
    expect(result.filter((pixel) => pixel === A)).toHaveLength(1)
  })
})

describe('blockSelection', () => {
  it('clamps the resulting selection to the canvas', () => {
    expect(blockSelection(blockOf(2, 2, []), 2, 3)).toEqual({ x0: 2, y0: 3, x1: 3, y1: 4 })
    expect(blockSelection(blockOf(2, 2, []), 63, 31)).toEqual({ x0: 63, y0: 31, x1: 63, y1: 31 })
    expect(blockSelection(blockOf(2, 2, []), 70, 40)).toBeNull()
  })
})
