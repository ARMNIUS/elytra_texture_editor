// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

function pointer(canvas: HTMLCanvasElement, type: 'pointerDown' | 'pointerUp', x: number, y: number) {
  fireEvent[type](canvas, { pointerId: 1, button: 0, buttons: type === 'pointerUp' ? 0 : 1, clientX: x, clientY: y })
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 320, width: 640, height: 320, toJSON: () => ({}),
  })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect
  Object.assign(HTMLElement.prototype, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) })
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pipette'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('eyedropper', () => {
  it('picks the painted color into the current color field', () => {
    renderApp()
    const hex = screen.getByLabelText('HEX текущего цвета') as HTMLInputElement
    const canvas = screen.getByLabelText('64 by 32 pixel texture canvas') as HTMLCanvasElement

    fireEvent.change(hex, { target: { value: '#ff0000' } })
    pointer(canvas, 'pointerDown', 100, 100)
    pointer(canvas, 'pointerUp', 100, 100)

    fireEvent.change(hex, { target: { value: '#0000ff' } })
    fireEvent.click(screen.getByLabelText('Пипетка'))
    pointer(canvas, 'pointerDown', 100, 100)
    pointer(canvas, 'pointerUp', 100, 100)

    expect((screen.getByLabelText('HEX текущего цвета') as HTMLInputElement).value).toBe('#ff0000')
    expect(screen.getByLabelText('Карандаш').className).toContain('tool-active')
  })
})
