import { describe, expect, it } from 'vitest'
import { transparentPixel } from '../data/palettes'
import { compositeLayers, createLayer, emptyLayerPixels, mergeLayerPixels, moveLayer } from './layers'
import { pixelIndex } from './texture'

function layerWithPixel(name: string, x: number, y: number, color: string) {
  const layer = createLayer(name)
  layer.pixels[pixelIndex(x, y)] = color
  return layer
}

describe('compositeLayers', () => {
  it('starts fully transparent', () => {
    const composite = compositeLayers([createLayer('Слой 1')])
    expect(new Set(composite)).toEqual(new Set([transparentPixel]))
  })

  it('flattens bottom-to-top so the upper opaque layer wins', () => {
    const bottom = layerWithPixel('bottom', 2, 2, '#ff0000')
    const top = layerWithPixel('top', 2, 2, '#0000ff')
    const composite = compositeLayers([bottom, top])
    expect(composite[pixelIndex(2, 2)]).toBe('#0000ff')
  })

  it('shows lower layers through transparent pixels', () => {
    const bottom = layerWithPixel('bottom', 4, 1, '#00ff00')
    const top = layerWithPixel('top', 5, 1, '#0000ff')
    const composite = compositeLayers([bottom, top])
    expect(composite[pixelIndex(4, 1)]).toBe('#00ff00')
    expect(composite[pixelIndex(5, 1)]).toBe('#0000ff')
  })

  it('ignores hidden and fully transparent layers', () => {
    const hidden = { ...layerWithPixel('hidden', 0, 0, '#ff0000'), visible: false }
    const faded = { ...layerWithPixel('faded', 0, 0, '#00ff00'), opacity: 0 }
    expect(compositeLayers([hidden, faded])[pixelIndex(0, 0)]).toBe(transparentPixel)
  })

  it('blends a half-opaque layer over the one below', () => {
    const bottom = layerWithPixel('bottom', 1, 1, '#ff0000')
    const top = { ...layerWithPixel('top', 1, 1, '#0000ff'), opacity: 50 }
    expect(compositeLayers([bottom, top])[pixelIndex(1, 1)]).toBe('#800080')
  })

  it('keeps per-pixel alpha of a lone layer', () => {
    const layer = layerWithPixel('alpha', 3, 3, '#ff000080')
    expect(compositeLayers([layer])[pixelIndex(3, 3)]).toBe('#ff000080')
  })
})

describe('mergeLayerPixels', () => {
  it('draws visible content over the bottom pixels', () => {
    const bottom = emptyLayerPixels()
    const top = layerWithPixel('top', 6, 6, '#abcdef')
    const merged = mergeLayerPixels(bottom, top)
    expect(merged[pixelIndex(6, 6)]).toBe('#abcdef')
    expect(bottom[pixelIndex(6, 6)]).toBe(transparentPixel)
  })

  it('skips hidden layers', () => {
    const bottom = emptyLayerPixels()
    const top = { ...layerWithPixel('top', 6, 6, '#abcdef'), visible: false }
    expect(mergeLayerPixels(bottom, top)[pixelIndex(6, 6)]).toBe(transparentPixel)
  })
})

describe('moveLayer', () => {
  const first = createLayer('one')
  const second = createLayer('two')
  const layers = [first, second]

  it('moves a layer up and down', () => {
    expect(moveLayer(layers, first.id, 1).map((layer) => layer.name)).toEqual(['two', 'one'])
    expect(moveLayer(layers, second.id, -1).map((layer) => layer.name)).toEqual(['two', 'one'])
  })

  it('returns the same array when the move is impossible', () => {
    expect(moveLayer(layers, first.id, -1)).toBe(layers)
    expect(moveLayer(layers, second.id, 1)).toBe(layers)
    expect(moveLayer(layers, 'missing', 1)).toBe(layers)
  })
})
