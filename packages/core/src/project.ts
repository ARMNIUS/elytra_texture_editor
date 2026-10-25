import { createLayerId, TEXTURE_PIXEL_COUNT } from './layers'
import type { Layer } from './layers'

export function isPixelArray(value: unknown, expectedLength = TEXTURE_PIXEL_COUNT): value is string[] {
  return Array.isArray(value) && value.length === expectedLength && value.every((pixel) => typeof pixel === 'string')
}

/**
 * Validates the `layers` array of a version 2 project document.
 * Returns null when the payload cannot be trusted; unknown fields fall back to sane defaults.
 */
export function parseProjectLayers(value: unknown, width = 64, height = 32): Layer[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const layers: Layer[] = []
  const ids = new Set<string>()
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) return null
    const entry = candidate as { id?: unknown; name?: unknown; visible?: unknown; opacity?: unknown; pixels?: unknown }
    if (!isPixelArray(entry.pixels, width * height)) return null
    const requestedId = typeof entry.id === 'string' && entry.id.length > 0 && !ids.has(entry.id) ? entry.id : createLayerId()
    ids.add(requestedId)
    layers.push({
      id: requestedId,
      name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim().slice(0, 40) : `Слой ${layers.length + 1}`,
      visible: typeof entry.visible === 'boolean' ? entry.visible : true,
      opacity: typeof entry.opacity === 'number' && Number.isFinite(entry.opacity) ? Math.max(0, Math.min(100, Math.round(entry.opacity))) : 100,
      pixels: [...entry.pixels],
    })
  }
  return layers
}
