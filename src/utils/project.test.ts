import { describe, expect, it } from 'vitest'
import { transparentPixel } from '@rawsprite/core/palettes'
import { TEXTURE_PIXEL_COUNT } from '@rawsprite/core/layers'
import { isPixelArray, parseProjectLayers } from '@rawsprite/core/project'

function pixels(color = transparentPixel): string[] {
  return Array.from({ length: TEXTURE_PIXEL_COUNT }, () => color)
}

describe('isPixelArray', () => {
  it('accepts a full 64x32 pixel array and rejects everything else', () => {
    expect(isPixelArray(pixels())).toBe(true)
    expect(isPixelArray([])).toBe(false)
    expect(isPixelArray(['#fff', 3])).toBe(false)
    expect(isPixelArray('nope')).toBe(false)
  })
})

describe('parseProjectLayers', () => {
  it('keeps valid layer metadata', () => {
    const parsed = parseProjectLayers([
      { id: 'base', name: 'Основа', visible: false, opacity: 42, pixels: pixels('#ff0000') },
    ])
    expect(parsed).not.toBeNull()
    expect(parsed![0]).toMatchObject({ id: 'base', name: 'Основа', visible: false, opacity: 42 })
    expect(parsed![0].pixels[0]).toBe('#ff0000')
    expect(parsed![0].pixels).not.toBe(pixels()[0])
  })

  it('fills defaults for missing or invalid metadata', () => {
    const parsed = parseProjectLayers([
      { pixels: pixels() },
      { name: '   ', visible: 'yes', opacity: 250, pixels: pixels() },
    ])
    expect(parsed).not.toBeNull()
    expect(parsed![0]).toMatchObject({ name: 'Слой 1', visible: true, opacity: 100 })
    expect(parsed![1]).toMatchObject({ name: 'Слой 2', visible: true, opacity: 100 })
  })

  it('replaces duplicate ids so the active layer stays unique', () => {
    const parsed = parseProjectLayers([
      { id: 'same', pixels: pixels() },
      { id: 'same', pixels: pixels() },
    ])
    expect(parsed).not.toBeNull()
    expect(parsed![0].id).toBe('same')
    expect(parsed![1].id).not.toBe('same')
  })

  it('rejects broken payloads instead of loading a partial document', () => {
    expect(parseProjectLayers(null)).toBeNull()
    expect(parseProjectLayers([])).toBeNull()
    expect(parseProjectLayers([{ pixels: [] }])).toBeNull()
    expect(parseProjectLayers(['layer'])).toBeNull()
    expect(parseProjectLayers([{ pixels: pixels() }, { pixels: ['#fff'] }])).toBeNull()
  })

  it('caps absurd values', () => {
    const parsed = parseProjectLayers([{ opacity: -20, name: 'x'.repeat(80), pixels: pixels() }])
    expect(parsed![0].opacity).toBe(0)
    expect(parsed![0].name).toHaveLength(40)
  })
})
