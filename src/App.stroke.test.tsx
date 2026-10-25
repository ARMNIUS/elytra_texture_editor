// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

type SavedLayer = { name: string; pixels: string[] }
type SavedProject = { version: number; layers: SavedLayer[] }

const TRAIT = '#00000000'

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

function pointer(canvas: HTMLCanvasElement, type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number) {
  fireEvent[type](canvas, { pointerId: 1, button: 0, buttons: type === 'pointerUp' ? 0 : 1, clientX: x, clientY: y })
}

async function saveProject(): Promise<SavedProject> {
  const createObjectURL = URL.createObjectURL as unknown as Mock
  const before = createObjectURL.mock.calls.length
  // The toolbar save button was removed; Ctrl+S is the canonical save path.
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  expect(createObjectURL.mock.calls.length).toBe(before + 1)
  const blob = createObjectURL.mock.calls[before][0] as Blob
  return JSON.parse(await blob.text()) as SavedProject
}

function paintedCount(layer: SavedLayer): number {
  return layer.pixels.filter((pixel) => pixel !== TRAIT).length
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

describe('stroke-level undo', () => {
  it('undoes a whole brush stroke in one step', async () => {
    renderApp()
    const baseline = await saveProject()
    const canvas = canvasElement()

    pointer(canvas, 'pointerDown', 20, 250)
    pointer(canvas, 'pointerMove', 40, 250)
    pointer(canvas, 'pointerMove', 60, 250)
    pointer(canvas, 'pointerMove', 80, 250)
    pointer(canvas, 'pointerUp', 80, 250)

    const afterStroke = await saveProject()
    expect(afterStroke.layers[0].pixels).not.toEqual(baseline.layers[0].pixels)
    expect(paintedCount(afterStroke.layers[0])).toBeGreaterThan(paintedCount(baseline.layers[0]))

    fireEvent.click(screen.getAllByTitle('Отменить')[0])

    const afterUndo = await saveProject()
    // One undo must revert the entire stroke, not just the last pointermove segment.
    expect(afterUndo.layers[0].pixels).toEqual(baseline.layers[0].pixels)
    expect((screen.getAllByTitle('Отменить')[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps separate strokes as separate undo steps', async () => {
    renderApp()
    const canvas = canvasElement()

    pointer(canvas, 'pointerDown', 20, 250)
    pointer(canvas, 'pointerUp', 20, 250)
    pointer(canvas, 'pointerDown', 40, 250)
    pointer(canvas, 'pointerUp', 40, 250)

    fireEvent.click(screen.getAllByTitle('Отменить')[0])
    expect((screen.getAllByTitle('Отменить')[0] as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getAllByTitle('Отменить')[0])
    expect((screen.getAllByTitle('Отменить')[0] as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('clipboard and layers', () => {
  it('pastes into a new layer and undoes it in one step', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()
    pointer(canvas, 'pointerDown', 20, 250)
    pointer(canvas, 'pointerUp', 20, 250)

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })
    expect(container.textContent).toContain('Скопировано')

    fireEvent.keyDown(window, { key: 'v', ctrlKey: true, shiftKey: true })
    expect(container.querySelectorAll('.layer-row')).toHaveLength(2)
    expect(container.textContent).toContain('Вставка')

    const project = await saveProject()
    expect(project.layers).toHaveLength(2)
    expect(paintedCount(project.layers[1])).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByTitle('Отменить')[0])
    expect(container.querySelectorAll('.layer-row')).toHaveLength(1)
  })

  it('copies the merged image instead of the empty active layer', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()
    pointer(canvas, 'pointerDown', 20, 250)
    pointer(canvas, 'pointerUp', 20, 250)

    // Add an empty layer above and make it active.
    fireEvent.click(screen.getByTitle('Новый слой'))
    expect(container.querySelectorAll('.layer-row')).toHaveLength(2)

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true, shiftKey: true })

    const project = await saveProject()
    const pasted = project.layers.find((layer) => layer.name === 'Вставка')
    expect(pasted).toBeDefined()
    // The active layer was empty; only a merged copy can bring the painted pixels over.
    expect(paintedCount(pasted!)).toBeGreaterThan(0)
  })

  it('paints the far corner of a custom-sized canvas', async () => {
    renderApp()
    fireEvent.click(screen.getByText('Файл'))
    fireEvent.click(screen.getByText('Новый проект…'))
    fireEvent.change(screen.getByLabelText('Ширина холста'), { target: { value: '16' } })
    fireEvent.change(screen.getByLabelText('Высота холста'), { target: { value: '8' } })
    fireEvent.click(screen.getByText('Создать'))

    const canvas = screen.getByLabelText('16 by 8 pixel texture canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = vi.fn(() => ({
      x: 0, y: 0, left: 0, top: 0, right: 160, bottom: 80, width: 160, height: 80, toJSON: () => ({}),
    })) as unknown as typeof canvas.getBoundingClientRect

    pointer(canvas, 'pointerDown', 150, 70)
    pointer(canvas, 'pointerUp', 150, 70)

    const project = await saveProject()
    expect(project.layers[0].pixels[7 * 16 + 15]).not.toBe(TRAIT)
  })
})
