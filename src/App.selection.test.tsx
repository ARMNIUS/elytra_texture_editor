// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

const CANVAS_WIDTH = 64 * 10
const CANVAS_HEIGHT = 32 * 10

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

function canvasElement(): HTMLCanvasElement {
  return screen.getByLabelText('64 by 32 pixel texture canvas') as HTMLCanvasElement
}

function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, clientX: from[0], clientY: from[1] })
  fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: to[0], clientY: to[1] })
  fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: to[0], clientY: to[1] })
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0, y: 0, left: 0, top: 0, right: CANVAS_WIDTH, bottom: CANVAS_HEIGHT,
    width: CANVAS_WIDTH, height: CANVAS_HEIGHT, toJSON: () => ({}),
  })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect
  const capture = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) }
  Object.assign(HTMLElement.prototype, capture)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('selection tool integration', () => {
  it('creates a rectangular marquee and reports its size', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvasElement(), [10, 10], [50, 40])

    const marquee = container.querySelector('.selection-marquee')
    expect(marquee).not.toBeNull()
    expect(marquee?.getAttribute('x')).toBe('1')
    expect(marquee?.getAttribute('y')).toBe('1')
    expect(marquee?.getAttribute('width')).toBe('5')
    expect(marquee?.getAttribute('height')).toBe('4')
    expect(container.textContent).toContain('SEL 5×4')
  })

  it('deselects when clicking outside the selection', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvasElement(), [0, 0], [20, 20])
    expect(container.querySelector('.selection-marquee')).not.toBeNull()

    // A click outside starts a new 1×1 marquee, which deselects.
    drag(canvasElement(), [600, 300], [600, 300])
    expect(container.querySelector('.selection-marquee')).toBeNull()
  })

  it('clips brush strokes to the selection and reports the active tool', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvasElement(), [0, 0], [30, 30])
    fireEvent.click(screen.getByTitle('Карандаш (B)'))
    drag(canvasElement(), [10, 10], [40, 40])

    expect(container.textContent).toContain('Рисование')
    expect(container.textContent).toContain('Карандаш')
    // The selection stays alive while painting inside it.
    expect(container.querySelector('.selection-marquee')).not.toBeNull()
  })

  it('shows a live preview while dragging a rectangle', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Прямоугольник (U)'))
    const canvas = canvasElement()
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: 50, clientY: 40 })

    expect(container.querySelector('.shape-preview rect')).not.toBeNull()
    // The preview is made of real pixels, one rect per rasterized outline pixel.
    const previewPixels = container.querySelectorAll('.shape-preview rect')
    expect(previewPixels.length).toBe(14)
    expect(previewPixels[0].getAttribute('fill')).toBe('#4ba3ff')
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 50, clientY: 40 })
    expect(container.querySelector('.shape-preview')).toBeNull()
  })

  it('shows the pointer dot plus the target cell for painting and shape tools', () => {
    const { container } = renderApp()
    const canvas = canvasElement()

    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 20 })
    expect(container.querySelector('.pixel-cursor')).not.toBeNull()
    expect(container.querySelector('.pixel-cursor-preview')).not.toBeNull()
    // The brush previews the resulting color, not just an outline.
    expect(container.querySelector('.pixel-cursor-cell')).toBeNull()

    fireEvent.click(screen.getByTitle('Прямоугольник (U)'))
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 30 })
    expect(container.querySelector('.pixel-cursor')).not.toBeNull()
    expect(container.querySelector('.pixel-cursor-cell')).not.toBeNull()
  })
})
