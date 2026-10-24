import { describe, expect, it } from 'vitest'
import { hexToRgb, hsvToRgb, normalizeColor, rgbToHex, rgbToHsv } from './color'

describe('normalizeColor', () => {
  it('expands short hex and lowercases', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc')
    expect(normalizeColor('  #4BA3FF ')).toBe('#4ba3ff')
  })

  it('rejects invalid and alpha values', () => {
    expect(normalizeColor('4ba3ff')).toBeNull()
    expect(normalizeColor('#12345')).toBeNull()
    expect(normalizeColor('#00000000')).toBeNull()
  })
})

describe('hex/rgb conversion', () => {
  it('parses lowercase and uppercase hex', () => {
    expect(hexToRgb('#4ba3ff')).toEqual({ r: 75, g: 163, b: 255 })
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('falls back to the editor accent color for garbage input', () => {
    expect(hexToRgb('not-a-color')).toEqual({ r: 75, g: 163, b: 255 })
  })

  it('clamps channels when writing hex', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 0 })).toBe('#ff0000')
    expect(rgbToHex({ r: 0, g: 128, b: 255 })).toBe('#0080ff')
  })
})

describe('hsv conversion', () => {
  it('maps primary colors to expected hue and back', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 })
    expect(rgbToHsv({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, v: 100 })
    expect(hsvToRgb({ h: 120, s: 100, v: 100 })).toEqual({ r: 0, g: 255, b: 0 })
    expect(hsvToRgb({ h: 240, s: 100, v: 100 })).toEqual({ r: 0, g: 0, b: 255 })
  })

  it('round-trips the palette accent color within integer-HSV rounding', () => {
    // rgbToHsv rounds H/S/V to integers for the picker sliders, which can shift a
    // channel by up to 2/255 (~0.8%) on a round trip. That is imperceptible in pixel art.
    const original = { r: 75, g: 163, b: 255 }
    const roundTrip = hsvToRgb(rgbToHsv(original))
    expect(Math.abs(roundTrip.r - original.r)).toBeLessThanOrEqual(2)
    expect(Math.abs(roundTrip.g - original.g)).toBeLessThanOrEqual(2)
    expect(Math.abs(roundTrip.b - original.b)).toBeLessThanOrEqual(2)
  })

  it('handles zero saturation and negative hue', () => {
    expect(rgbToHsv({ r: 18, g: 18, b: 18 })).toEqual({ h: 0, s: 0, v: 7 })
    expect(hsvToRgb({ h: -120, s: 100, v: 100 })).toEqual({ r: 0, g: 0, b: 255 })
  })
})
