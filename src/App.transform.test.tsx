// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

type SavedProject = { layers: Array<{ pixels: string[] }> }
const TRAIT = '#00000000'
const PAINT = '#4ba3ff'

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

async function saveProject(): Promise<SavedProject> {
  const createObjectURL = URL.createObjectURL as unknown as Mock
  const before = createObjectURL.mock.calls.length
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  const blob = createObjectURL.mock.calls[before][0] as Blob
  return JSON.parse(await blob.text()) as SavedProject
}

function selectionLabel(container: HTMLElement): string {
  return container.querySelector('.selection-readout')?.textContent ?? ''
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 320, width: 640, height: 320, toJSON: () => ({}),
  })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect
  Object.assign(HTMLElement.prototype, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) })
  Object.assign(HTMLAnchorElement.prototype, { click: vi.fn() })
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mts-test'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('selection transform', () => {
  it('moves the selected pixels and keeps one undo step', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()
    // Paint one pixel at (5, 5) and select the 3×3 area around it.
    drag(canvas, [50, 50], [50, 50])
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvas, [40, 40], [60, 60])
    expect(selectionLabel(container)).toContain('SEL 3×3')

    const before = await saveProject()
    expect(before.layers[0].pixels[5 * 64 + 5]).toBe(PAINT)

    // Drag inside the selection four pixels to the right.
    drag(canvas, [50, 50], [90, 50])
    const after = await saveProject()

    expect(after.layers[0].pixels[5 * 64 + 9]).toBe(PAINT)
    expect(after.layers[0].pixels[5 * 64 + 5]).toBe(TRAIT)
    expect(container.querySelector('.selection-marquee')?.getAttribute('x')).toBe('8')

    fireEvent.click(screen.getAllByTitle('Отменить')[0])
    const undone = await saveProject()
    expect(undone.layers[0].pixels).toEqual(before.layers[0].pixels)
  })

  it('resizes from a corner handle with nearest-neighbour stretching', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()
    drag(canvas, [50, 50], [50, 50])
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvas, [40, 40], [60, 60])

    // The south-east handle sits at pixel (7, 7), i.e. 70px in both axes.
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, clientX: 70, clientY: 70 })
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: 90, clientY: 80 })
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 90, clientY: 80 })

    expect(selectionLabel(container)).toContain('SEL 5×4')
    const saved = await saveProject()
    // Nearest-neighbour stretching replicates the single painted pixel.
    expect(saved.layers[0].pixels.filter((pixel) => pixel === PAINT).length).toBeGreaterThan(0)
  })

  it('rotates the selection content with the header buttons', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()
    drag(canvas, [50, 50], [50, 50])
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvas, [40, 40], [60, 50])
    expect(selectionLabel(container)).toContain('SEL 3×2')

    fireEvent.click(screen.getByTitle('Повернуть на 90° по часовой'))
    expect(selectionLabel(container)).toContain('SEL 2×3')

    fireEvent.click(screen.getByTitle('Отразить по горизонтали'))
    expect(selectionLabel(container)).toContain('SEL 2×3')
  })

  it('renders eight transform handles for an active selection', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvasElement(), [40, 40], [60, 60])
    expect(container.querySelectorAll('.selection-handle')).toHaveLength(8)
  })

  it('clicking inside the selection does not create a transform history step', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()
    drag(canvas, [50, 50], [50, 50])
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvas, [40, 40], [60, 60])
    const before = await saveProject()

    // A stationary click inside starts and immediately finishes a no-op transform.
    drag(canvas, [50, 50], [50, 50])
    const after = await saveProject()
    expect(after.layers[0].pixels).toEqual(before.layers[0].pixels)
    expect(container.textContent).toContain('SEL 3×3')

    // Undo must revert the paint stroke, which proves the click added no history.
    fireEvent.click(screen.getAllByTitle('Отменить')[0])
    const undone = await saveProject()
    expect(undone.layers[0].pixels[5 * 64 + 5]).toBe(TRAIT)
  })

  it('cancels an in-progress move with Escape and restores the pixels', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()
    drag(canvas, [50, 50], [50, 50])
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    drag(canvas, [40, 40], [60, 60])
    const before = await saveProject()

    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: 100, clientY: 50 })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 100, clientY: 50 })

    expect(container.textContent).toContain('Трансформация отменена')
    const after = await saveProject()
    expect(after.layers[0].pixels).toEqual(before.layers[0].pixels)
  })

  it('keeps the selection size when dragging it repeatedly on a large canvas', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByLabelText('Новый проект'))
    fireEvent.change(screen.getByLabelText('Ширина холста'), { target: { value: '128' } })
    fireEvent.change(screen.getByLabelText('Высота холста'), { target: { value: '64' } })
    fireEvent.click(screen.getByText('Создать'))

    const canvas = screen.getByLabelText('128 by 64 pixel texture canvas') as HTMLCanvasElement
    const wrapper = container.querySelector('.pixel-canvas-wrap') as HTMLDivElement
    const rect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 960, bottom: 480, width: 960, height: 480, toJSON: () => ({}) })
    canvas.getBoundingClientRect = vi.fn(rect) as unknown as typeof canvas.getBoundingClientRect
    wrapper.getBoundingClientRect = vi.fn(rect)
    fireEvent.click(screen.getByTitle('Выделение (M)'))
    // Fit zoom for 128×64 is 7.5 CSS px per texture pixel.
    drag(canvas, [600, 300], [749, 449])
    expect(selectionLabel(container)).toContain('20×20')

    drag(canvas, [630, 330], [637, 337])
    expect(selectionLabel(container)).toContain('20×20')
    drag(canvas, [637, 337], [645, 345])
    expect(selectionLabel(container)).toContain('20×20')
  })
})
