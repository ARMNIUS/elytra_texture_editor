import { transparentPixel } from '../data/palettes'
import { compositeRgba, formatRgba, parseRgba } from './color'
import { TEXTURE_HEIGHT, TEXTURE_WIDTH } from './texture'

export const TEXTURE_PIXEL_COUNT = TEXTURE_WIDTH * TEXTURE_HEIGHT

export type Layer = {
  id: string
  name: string
  visible: boolean
  /** 0..100, applied while flattening the stack. */
  opacity: number
  pixels: string[]
}

let layerCounter = 0

export function createLayerId(): string {
  layerCounter += 1
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `layer-${Date.now().toString(36)}-${layerCounter}`
}

export function emptyLayerPixels(): string[] {
  return Array.from({ length: TEXTURE_PIXEL_COUNT }, () => transparentPixel)
}

export function createLayer(name: string, pixels?: string[]): Layer {
  return {
    id: createLayerId(),
    name,
    visible: true,
    opacity: 100,
    pixels: pixels && pixels.length === TEXTURE_PIXEL_COUNT ? [...pixels] : emptyLayerPixels(),
  }
}

export function cloneLayer(layer: Layer, name = `${layer.name} копия`): Layer {
  return { ...layer, id: createLayerId(), name, pixels: [...layer.pixels] }
}

export function layersFromPixels(pixels: string[], name = 'Слой 1'): Layer[] {
  return [createLayer(name, pixels)]
}

export function nextLayerName(layers: Layer[]): string {
  let index = layers.length + 1
  const names = new Set(layers.map((layer) => layer.name))
  while (names.has(`Слой ${index}`)) index += 1
  return `Слой ${index}`
}

/** Flattens bottom-to-top layers into a single RGBA texture. */
export function compositeLayers(layers: Layer[]): string[] {
  const result = emptyLayerPixels()
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const opacity = Math.max(0, Math.min(1, layer.opacity / 100))
    for (let index = 0; index < TEXTURE_PIXEL_COUNT; index++) {
      const topPixel = layer.pixels[index]
      if (!topPixel || topPixel === transparentPixel) continue
      const top = parseRgba(topPixel)
      if (top.a === 0) continue
      // Opaque pixels on a fully opaque layer replace whatever is below: the common case.
      if (opacity === 1 && top.a === 255) {
        result[index] = formatRgba(top)
        continue
      }
      const bottom = parseRgba(result[index])
      if (bottom.a === 0) {
        result[index] = opacity === 1 ? formatRgba(top) : formatRgba({ ...top, a: Math.round(top.a * opacity) })
        continue
      }
      result[index] = formatRgba(compositeRgba(bottom, top, opacity))
    }
  }
  return result
}

/** Draws `top` onto `bottomPixels`, honouring the top layer's visibility and opacity. */
export function mergeLayerPixels(bottomPixels: string[], top: Layer): string[] {
  if (!top.visible || top.opacity <= 0) return [...bottomPixels]
  const opacity = Math.max(0, Math.min(1, top.opacity / 100))
  const result = [...bottomPixels]
  for (let index = 0; index < TEXTURE_PIXEL_COUNT; index++) {
    const topPixel = top.pixels[index]
    if (!topPixel || topPixel === transparentPixel) continue
    const topRgba = parseRgba(topPixel)
    if (topRgba.a === 0) continue
    const bottom = parseRgba(result[index])
    if (bottom.a === 0) {
      result[index] = opacity === 1 ? formatRgba(topRgba) : formatRgba({ ...topRgba, a: Math.round(topRgba.a * opacity) })
      continue
    }
    result[index] = formatRgba(compositeRgba(bottom, topRgba, opacity))
  }
  return result
}

/** Moves a layer by one slot. `direction` 1 = up (towards the top of the stack). */
export function moveLayer(layers: Layer[], id: string, direction: 1 | -1): Layer[] {
  const index = layers.findIndex((layer) => layer.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= layers.length) return layers
  const next = [...layers]
  const [layer] = next.splice(index, 1)
  next.splice(target, 0, layer)
  return next
}
