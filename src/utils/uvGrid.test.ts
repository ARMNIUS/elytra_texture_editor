import { describe, expect, it } from 'vitest'
import { BufferGeometry, Float32BufferAttribute, PlaneGeometry } from 'three'
import { makeUvGridGeometry } from './uvGrid'

function positions(geometry: BufferGeometry): number[] {
  const attribute = geometry.getAttribute('position')
  return attribute ? Array.from(attribute.array as ArrayLike<number>) : []
}

describe('makeUvGridGeometry', () => {
  it('emits pixel-boundary line segments for a textured plane', () => {
    const grid = makeUvGridGeometry(new PlaneGeometry(2, 2))
    const data = positions(grid)
    expect(data.length).toBeGreaterThan(0)
    expect(data.length % 6).toBe(0)
    expect(data.every(Number.isFinite)).toBe(true)
  })

  it('duplicates the guide on both sides of a double-sided surface', () => {
    const grid = makeUvGridGeometry(new PlaneGeometry(2, 2), 0.01)
    const data = positions(grid)
    const zValues = data.filter((_, index) => index % 3 === 2)
    const uniqueZ = [...new Set(zValues.map((value) => value.toFixed(4)))]
    expect(uniqueZ).toContain('0.0100')
    expect(uniqueZ).toContain('-0.0100')
  })

  it('keeps the grid inside the plane', () => {
    const grid = makeUvGridGeometry(new PlaneGeometry(2, 2))
    const data = positions(grid)
    for (let index = 0; index < data.length; index += 3) {
      expect(Math.abs(data[index])).toBeLessThanOrEqual(1.001)
      expect(Math.abs(data[index + 1])).toBeLessThanOrEqual(1.001)
    }
  })

  it('returns an empty geometry when the source has no UVs', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
    const grid = makeUvGridGeometry(geometry)
    expect(grid.getAttribute('position')).toBeUndefined()
  })
})
