export type RGB = { r: number; g: number; b: number }
export type HSV = { h: number; s: number; v: number }
export type Rgba = { r: number; g: number; b: number; a: number }

const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const RGBA_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FALLBACK_COLOR = '#4ba3ff'

const rgbaCache = new Map<string, Rgba>()

/** Accepts #rgb and #rrggbb, returns lowercase #rrggbb or null for anything else. */
export function normalizeColor(value: string): string | null {
  const cleaned = value.trim()
  if (!COLOR_RE.test(cleaned)) return null
  if (cleaned.length === 4) return `#${cleaned.slice(1).split('').map((character) => character + character).join('')}`.toLowerCase()
  return cleaned.toLowerCase()
}

/** Accepts #rgb, #rrggbb and #rrggbbaa; returns the canonical hex form (alpha dropped when 255). */
export function normalizeRgbaColor(value: string): string | null {
  const cleaned = value.trim()
  if (!RGBA_RE.test(cleaned)) return null
  return formatRgbaExact(parseRgba(cleaned))
}

/** Drops the alpha channel, for palette entries which are always opaque. */
export function opaqueColor(value: string): string {
  return formatRgba({ ...parseRgba(value), a: 255 })
}

/** Replaces only the alpha channel of an existing color, keeping its RGB at alpha 0. */
export function withAlpha(value: string, alpha: number): string {
  return formatRgbaExact({ ...parseRgba(value), a: Math.max(0, Math.min(255, Math.round(alpha))) })
}

export function hexToRgb(hex: string): RGB {
  const full = normalizeColor(hex) ?? FALLBACK_COLOR
  return { r: Number.parseInt(full.slice(1, 3), 16), g: Number.parseInt(full.slice(3, 5), 16), b: Number.parseInt(full.slice(5, 7), 16) }
}

/** Parses #rgb, #rrggbb and #rrggbbaa texture pixels. Invalid input is fully transparent. */
export function parseRgba(color: string): Rgba {
  const cached = rgbaCache.get(color)
  if (cached) return cached
  let value: Rgba = { r: 0, g: 0, b: 0, a: 0 }
  const cleaned = color.trim().toLowerCase()
  if (RGBA_RE.test(cleaned)) {
    const hex = cleaned.length === 4
      ? cleaned.slice(1).split('').map((character) => character + character).join('')
      : cleaned.slice(1)
    value = {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
    }
  }
  // Texture colors are drawn from a picker, so the cache stays small in practice.
  if (rgbaCache.size > 4096) rgbaCache.clear()
  rgbaCache.set(color, value)
  return value
}

function hexChannel(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')
}

export function formatRgba({ r, g, b, a }: Rgba): string {
  const alpha = Math.round(Math.max(0, Math.min(255, a)))
  if (alpha === 0) return '#00000000'
  const base = `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`
  return alpha === 255 ? base : `${base}${hexChannel(alpha)}`
}

/**
 * Like formatRgba but keeps the RGB channels even at alpha 0.
 * The color picker needs this: turning alpha to zero must not destroy the hue.
 */
export function formatRgbaExact({ r, g, b, a }: Rgba): string {
  const alpha = Math.round(Math.max(0, Math.min(255, a)))
  const base = `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`
  return alpha === 255 ? base : `${base}${hexChannel(alpha)}`
}

/** Source-over compositing used to flatten the layer stack and merge layers. */
export function compositeRgba(bottom: Rgba, top: Rgba, opacity = 1): Rgba {
  const topAlpha = (top.a / 255) * Math.max(0, Math.min(1, opacity))
  const bottomAlpha = bottom.a / 255
  const outAlpha = topAlpha + bottomAlpha * (1 - topAlpha)
  if (outAlpha <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (topChannel: number, bottomChannel: number) => (topChannel * topAlpha + bottomChannel * bottomAlpha * (1 - topAlpha)) / outAlpha
  return {
    r: Math.round(mix(top.r, bottom.r)),
    g: Math.round(mix(top.g, bottom.g)),
    b: Math.round(mix(top.b, bottom.b)),
    a: Math.round(outAlpha * 255),
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2)
    else h = 60 * ((rn - gn) / delta + 4)
  }
  return { h: Math.round((h + 360) % 360) % 360, s: max === 0 ? 0 : Math.round((delta / max) * 100), v: Math.round(max * 100) }
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hue = ((h % 360) + 360) % 360
  const saturation = Math.max(0, Math.min(100, s)) / 100
  const value = Math.max(0, Math.min(100, v)) / 100
  const c = value * saturation
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = value - c
  let parts: [number, number, number]
  if (hue < 60) parts = [c, x, 0]
  else if (hue < 120) parts = [x, c, 0]
  else if (hue < 180) parts = [0, c, x]
  else if (hue < 240) parts = [0, x, c]
  else if (hue < 300) parts = [x, 0, c]
  else parts = [c, 0, x]
  return { r: Math.round((parts[0] + m) * 255), g: Math.round((parts[1] + m) * 255), b: Math.round((parts[2] + m) * 255) }
}
