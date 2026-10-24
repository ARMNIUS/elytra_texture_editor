import { describe, expect, it } from 'vitest'
import { clampRect, containsPoint, ellipseOutlinePoints, linePoints, normalizeRect, rectOutlinePoints, shapePoints } from './shapes'

describe('normalizeRect', () => {
  it('orders corners', () => {
    expect(normalizeRect(5, 7, 2, 3)).toEqual({ x0: 2, y0: 3, x1: 5, y1: 7 })
    expect(normalizeRect(1, 1, 1, 1)).toEqual({ x0: 1, y0: 1, x1: 1, y1: 1 })
  })
})

describe('clampRect', () => {
  it('clips to the texture and rejects empty results', () => {
    expect(clampRect({ x0: -4, y0: -2, x1: 100, y1: 100 }, 64, 32)).toEqual({ x0: 0, y0: 0, x1: 63, y1: 31 })
    expect(clampRect({ x0: 70, y0: 40, x1: 80, y1: 50 }, 64, 32)).toEqual({ x0: 63, y0: 31, x1: 63, y1: 31 })
  })
})

describe('containsPoint', () => {
  it('treats a missing selection as everything', () => {
    expect(containsPoint(null, 999, -5)).toBe(true)
    expect(containsPoint({ x0: 1, y0: 1, x1: 2, y1: 2 }, 2, 2)).toBe(true)
    expect(containsPoint({ x0: 1, y0: 1, x1: 2, y1: 2 }, 3, 2)).toBe(false)
  })
})

describe('linePoints', () => {
  it('includes both endpoints', () => {
    expect(linePoints(0, 0, 3, 0)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]])
    expect(linePoints(2, 2, 2, 2)).toEqual([[2, 2]])
  })

  it('walks a diagonal in one-pixel steps', () => {
    expect(linePoints(0, 0, 3, 3)).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]])
  })
})

describe('rectOutlinePoints', () => {
  it('marks only the border without duplicates', () => {
    const points = rectOutlinePoints(0, 0, 2, 2)
    expect(points).toHaveLength(8)
    const keys = new Set(points.map(([x, y]) => `${x}:${y}`))
    expect(keys.size).toBe(points.length)
    expect(keys.has('1:1')).toBe(false)
  })
})

describe('ellipseOutlinePoints', () => {
  it('stays inside the bounding box and is symmetric', () => {
    const points = ellipseOutlinePoints(0, 0, 10, 6)
    expect(points.length).toBeGreaterThan(6)
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(10)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(6)
    }
    const keys = new Set(points.map(([x, y]) => `${x}:${y}`))
    expect(keys.has('0:3')).toBe(true)
    expect(keys.has('10:3')).toBe(true)
  })

  it('degenerates to a line for zero height', () => {
    const points = ellipseOutlinePoints(2, 4, 6, 4)
    expect(points.every(([, y]) => y === 4)).toBe(true)
    expect(points.length).toBe(5)
  })
})

describe('shapePoints', () => {
  it('dispatches by kind', () => {
    expect(shapePoints({ kind: 'line', x0: 0, y0: 0, x1: 1, y1: 0 })).toHaveLength(2)
    expect(shapePoints({ kind: 'rect', x0: 0, y0: 0, x1: 1, y1: 1 })).toHaveLength(4)
    expect(shapePoints({ kind: 'ellipse', x0: 0, y0: 0, x1: 4, y1: 4 }).length).toBeGreaterThan(4)
  })
})
