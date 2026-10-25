import React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { formatRgbaExact, hsvToRgb, normalizeRgbaColor, parseRgba, rgbToHsv, withAlpha } from '@rawsprite/core/color'
import type { HSV, RGB } from '@rawsprite/core/color'

type Props = {
  color: string
  baselineColor: string
  onPreview: (color: string) => void
  onClose: () => void
}

const CHECKER = 'linear-gradient(45deg, #b9b9b9 25%, transparent 25%), linear-gradient(-45deg, #b9b9b9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #b9b9b9 75%), linear-gradient(-45deg, transparent 75%, #b9b9b9 75%)'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toRgbCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`
}

export default function ColorEditorWindow({ color, baselineColor, onPreview, onClose }: Props) {
  const [position, setPosition] = useState(() => ({
    x: typeof window === 'undefined' ? 260 : clamp(260, 8, Math.max(8, window.innerWidth - 348)),
    y: typeof window === 'undefined' ? 120 : clamp(120, 8, Math.max(8, window.innerHeight - 420)),
  }))
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const rgba = parseRgba(color)
  const hsv = rgbToHsv({ r: rgba.r, g: rgba.g, b: rgba.b })
  const [hexDraft, setHexDraft] = useState(() => formatRgbaExact(rgba))
  // H and S disappear from RGB when a color is black or gray. Keep drafts so the
  // sliders do not snap back to zero while the user tunes value/saturation.
  const [hueDraft, setHueDraft] = useState(hsv.h)
  const [satDraft, setSatDraft] = useState(hsv.s)
  const lastColorRef = useRef(color)
  const hasChroma = hsv.s > 0 && hsv.v > 0

  useEffect(() => {
    if (hasChroma) setHueDraft(hsv.h)
  }, [hasChroma, hsv.h])
  useEffect(() => {
    if (hsv.v > 0) setSatDraft(hsv.s)
  }, [hsv.s, hsv.v])

  const displayHue = hasChroma ? hsv.h : hueDraft
  const displaySaturation = hsv.v > 0 ? hsv.s : satDraft

  // Keep the HEX field in sync when the color changes elsewhere (eyedropper, palette),
  // without fighting the user while they type an equivalent representation.
  useEffect(() => {
    if (lastColorRef.current === color) return
    lastColorRef.current = color
    if (normalizeRgbaColor(hexDraft) !== color) setHexDraft(formatRgbaExact(parseRgba(color)))
  }, [color, hexDraft])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const applyRgb = (partial: Partial<RGB>) => onPreview(formatRgbaExact({ r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a, ...partial }))
  const applyHsv = (partial: Partial<HSV>) => {
    const next = { h: displayHue, s: displaySaturation, v: hsv.v, ...partial }
    const rgb = hsvToRgb(next)
    onPreview(formatRgbaExact({ r: rgb.r, g: rgb.g, b: rgb.b, a: rgba.a }))
  }

  const saturationStart = hsvToRgb({ h: displayHue, s: 0, v: hsv.v })
  const valueEnd = hsvToRgb({ h: displayHue, s: displaySaturation, v: 100 })

  const rows: Array<{
    key: string
    label: string
    value: number
    max: number
    background: string
    onChange: (value: number) => void
  }> = [
    {
      key: 'h', label: 'H', value: displayHue, max: 359,
      background: 'linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
      onChange: (value) => { setHueDraft(value); applyHsv({ h: value }) },
    },
    {
      key: 's', label: 'S', value: displaySaturation, max: 100,
      background: `linear-gradient(90deg, ${toRgbCss(saturationStart)}, ${toRgbCss(hsvToRgb({ h: displayHue, s: 100, v: hsv.v }))})`,
      onChange: (value) => { setSatDraft(value); applyHsv({ s: value }) },
    },
    {
      key: 'v', label: 'V', value: hsv.v, max: 100,
      background: `linear-gradient(90deg, #000, ${toRgbCss(valueEnd)})`,
      onChange: (value) => applyHsv({ v: value }),
    },
    {
      key: 'r', label: 'R', value: rgba.r, max: 255,
      background: `linear-gradient(90deg, ${toRgbCss({ r: 0, g: rgba.g, b: rgba.b })}, ${toRgbCss({ r: 255, g: rgba.g, b: rgba.b })})`,
      onChange: (value) => applyRgb({ r: value }),
    },
    {
      key: 'g', label: 'G', value: rgba.g, max: 255,
      background: `linear-gradient(90deg, ${toRgbCss({ r: rgba.r, g: 0, b: rgba.b })}, ${toRgbCss({ r: rgba.r, g: 255, b: rgba.b })})`,
      onChange: (value) => applyRgb({ g: value }),
    },
    {
      key: 'b', label: 'B', value: rgba.b, max: 255,
      background: `linear-gradient(90deg, ${toRgbCss({ r: rgba.r, g: rgba.g, b: 0 })}, ${toRgbCss({ r: rgba.r, g: rgba.g, b: 255 })})`,
      onChange: (value) => applyRgb({ b: value }),
    },
    {
      key: 'a', label: 'A', value: rgba.a, max: 255,
      background: `linear-gradient(90deg, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0), rgb(${rgba.r}, ${rgba.g}, ${rgba.b})), ${CHECKER}`,
      onChange: (value) => onPreview(withAlpha(color, value)),
    },
  ]

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Buttons inside the title bar (the close control) keep their own click.
    if (event.target instanceof HTMLElement && event.target.closest('button')) return
    event.preventDefault()
    dragRef.current = { dx: event.clientX - position.x, dy: event.clientY - position.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setPosition({
      x: clamp(event.clientX - drag.dx, 4, Math.max(4, window.innerWidth - 340)),
      y: clamp(event.clientY - drag.dy, 4, Math.max(4, window.innerHeight - 120)),
    })
  }
  const endDrag = () => { dragRef.current = null }

  return createPortal(
    <section
      className="color-editor-window"
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-modal="false"
      aria-label="Редактор цвета"
    >
      <header
        className="color-editor-titlebar"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span>ЦВЕТ</span>
        <button
          type="button"
          className="color-editor-close"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Закрыть редактор цвета"
        ><X size={12} /></button>
      </header>

      <div className="color-editor-body">
        <div className="color-ab" aria-label="Сравнение A и B">
          <button
            type="button"
            className="color-ab-swatch"
            title="Вернуть цвет A"
            onClick={() => onPreview(baselineColor)}
          >
            <span className="color-ab-checker" />
            <span className="color-ab-fill" style={{ backgroundColor: baselineColor }} />
            <span className="color-ab-label">A · было</span>
          </button>
          <div className="color-ab-swatch" title="Текущий цвет B">
            <span className="color-ab-checker" />
            <span className="color-ab-fill" style={{ backgroundColor: color }} />
            <span className="color-ab-label">B · сейчас</span>
          </div>
          <div className="color-ab-hex">
            <span>{formatRgbaExact(parseRgba(baselineColor))}</span>
            <span>{formatRgbaExact(rgba)}</span>
          </div>
        </div>

        <div className="color-slider-stack">
          {rows.map((row) => (
            <div className="color-slider-row" key={row.key}>
              <span className="color-slider-label">{row.label}</span>
              <input
                className="color-slider"
                type="range"
                min="0"
                max={row.max}
                value={row.value}
                style={{
                  backgroundImage: row.background,
                  backgroundRepeat: row.key === 'a' ? 'no-repeat, repeat' : 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundSize: row.key === 'a' ? '100% 100%, 8px 8px' : '100% 100%',
                }}
                onChange={(event) => row.onChange(Number(event.target.value))}
                aria-label={`${row.label}: ${row.value}`}
              />
              <input
                className="color-slider-number"
                type="number"
                min="0"
                max={row.max}
                value={row.value}
                onChange={(event) => {
                  if (event.target.value === '') return
                  const next = Number(event.target.value)
                  if (Number.isFinite(next)) row.onChange(clamp(Math.round(next), 0, row.max))
                }}
                aria-label={`${row.label} значение`}
              />
            </div>
          ))}
        </div>

        <label className="color-editor-hex-row">
          <span>HEX</span>
          <input
            value={hexDraft}
            aria-label="HEX/HEXA цвета"
            onChange={(event) => {
              const value = event.target.value
              setHexDraft(value)
              const normalized = normalizeRgbaColor(value)
              if (normalized) onPreview(normalized)
            }}
            onBlur={() => {
              const normalized = normalizeRgbaColor(hexDraft)
              setHexDraft(normalized ?? formatRgbaExact(rgba))
            }}
          />
          <span className="color-editor-hex-preview" style={{ backgroundColor: color }} />
        </label>
      </div>
    </section>,
    document.body,
  )
}

// Keep React in scope for environments that still use the classic JSX transform.
void React
