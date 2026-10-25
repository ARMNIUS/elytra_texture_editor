// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'
import { TEXTURE_PIXEL_COUNT } from '@rawsprite/core/layers'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

type SavedProject = { filename: string; layers: Array<{ pixels: string[] }> }
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

function openNewProject() {
  fireEvent.click(screen.getByLabelText('Новый проект'))
}

function confirmNewProject() {
  fireEvent.click(screen.getByText('Создать'))
}

function createProject(width = 64, height = 32) {
  openNewProject()
  fireEvent.change(screen.getByLabelText('Ширина холста'), { target: { value: String(width) } })
  fireEvent.change(screen.getByLabelText('Высота холста'), { target: { value: String(height) } })
  confirmNewProject()
}

function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, clientX: from[0], clientY: from[1] })
  fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: to[0], clientY: to[1] })
  fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: to[0], clientY: to[1] })
}

function tabs(container: HTMLElement) {
  return container.querySelectorAll('.document-tab')
}

function activeTabName(container: HTMLElement): string {
  return container.querySelector('.document-tab-active .document-tab-name')?.textContent ?? ''
}

async function saveProject(): Promise<SavedProject> {
  const createObjectURL = URL.createObjectURL as unknown as Mock
  const before = createObjectURL.mock.calls.length
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  const blob = createObjectURL.mock.calls[before][0] as Blob
  return JSON.parse(await blob.text()) as SavedProject
}

function projectInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[accept=".mts,.json,application/json"]') as HTMLInputElement
}

function makeProject(name: string, color: string) {
  return {
    format: 'minecraft-texture-studio-project',
    version: 2,
    filename: name,
    activeLayerId: 'layer-a',
    layers: [{ id: 'layer-a', name: 'Слой 1', visible: true, opacity: 100, pixels: Array.from({ length: TEXTURE_PIXEL_COUNT }, () => color) }],
    settings: { tool: 'brush', viewMode: '2d' },
    shortcuts: {},
    palettes: {},
  }
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

describe('multiple projects', () => {
  it('creates a new project tab and switches to it', () => {
    const { container } = renderApp()
    expect(tabs(container)).toHaveLength(1)
    expect(activeTabName(container)).toBe('elytra.png')

    createProject()
    expect(tabs(container)).toHaveLength(2)
    expect(activeTabName(container)).toBe('Без названия 1.mts')
    expect((container.querySelector('.document-title input') as HTMLInputElement).value).toBe('Без названия 1.mts')
    expect(container.querySelectorAll('.document-tab-active')).toHaveLength(1)
  })

  it('supports Ctrl+N and Ctrl+Tab', () => {
    const { container } = renderApp()
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    confirmNewProject()
    expect(tabs(container)).toHaveLength(2)

    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true })
    expect(activeTabName(container)).toBe('elytra.png')
    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true })
    expect(activeTabName(container)).toBe('Без названия 1.mts')
  })

  it('keeps pixels and history per tab', async () => {
    const { container } = renderApp()
    const canvas = canvasElement()

    // Tab 1: paint one pixel at (5, 5).
    drag(canvas, [50, 50], [50, 50])
    createProject()
    // Tab 2: paint a different pixel at (20, 20).
    drag(canvas, [200, 200], [200, 200])

    const second = await saveProject()
    expect(second.layers[0].pixels[20 * 64 + 20]).toBe(PAINT)
    expect(second.layers[0].pixels[5 * 64 + 5]).toBe(TRAIT)

    // Back to tab 1.
    fireEvent.click(tabs(container)[0] as HTMLElement)
    expect(activeTabName(container)).toBe('elytra.png')
    const first = await saveProject()
    expect(first.layers[0].pixels[5 * 64 + 5]).toBe(PAINT)
    expect(first.layers[0].pixels[20 * 64 + 20]).toBe(TRAIT)

    // Undo happens in the active tab only.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    const undone = await saveProject()
    expect(undone.layers[0].pixels[5 * 64 + 5]).toBe(TRAIT)

    // Tab 2 still has its own pixel.
    fireEvent.click(tabs(container)[1] as HTMLElement)
    const secondAgain = await saveProject()
    expect(secondAgain.layers[0].pixels[20 * 64 + 20]).toBe(PAINT)
    expect(secondAgain.layers[0].pixels[5 * 64 + 5]).toBe(TRAIT)
  })

  it('asks before closing a dirty tab and keeps one tab alive', () => {
    const { container } = renderApp()
    drag(canvasElement(), [50, 50], [50, 50])
    expect(tabs(container)).toHaveLength(1)

    fireEvent.click(screen.getByLabelText('Закрыть elytra.png'))
    const dialog = screen.getByRole('alertdialog', { name: 'Закрытие проекта' })
    expect(dialog).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(tabs(container)).toHaveLength(1)

    fireEvent.click(screen.getByLabelText('Закрыть elytra.png'))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Закрыть' }))
    // Closing the last tab creates a fresh empty project.
    expect(tabs(container)).toHaveLength(1)
    expect(activeTabName(container)).toBe('Без названия 1.mts')
  })

  it('starts with the bundled elytra texture', async () => {
    renderApp()
    const project = await saveProject()
    const opaque = project.layers[0].pixels.filter((pixel) => !pixel.endsWith('00'))
    expect(opaque.length).toBeGreaterThan(100)
    expect(project.layers[0].pixels).toHaveLength(2048)
  })

  it('creates a blank project from the size dialog', async () => {
    renderApp()
    createProject()
    const project = await saveProject()
    expect(project.layers[0].pixels).toHaveLength(2048)
    expect(project.layers[0].pixels.every((pixel) => pixel === TRAIT)).toBe(true)
  })

  it('saves with Ctrl+S and Ctrl+Shift+S even on a Russian layout', () => {
    renderApp()
    const createObjectURL = URL.createObjectURL as unknown as Mock
    const before = createObjectURL.mock.calls.length
    fireEvent.keyDown(window, { key: 'ы', code: 'KeyS', ctrlKey: true })
    expect(createObjectURL.mock.calls.length).toBe(before + 1)
    fireEvent.keyDown(window, { key: 'Ы', code: 'KeyS', ctrlKey: true, shiftKey: true })
    expect(createObjectURL.mock.calls.length).toBe(before + 2)
  })

  it('clears the texture without opening a browser confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderApp()
    fireEvent.click(screen.getByTitle('Новая пустая текстура'))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('opens a project in a new tab when the current one is dirty', async () => {
    const { container } = renderApp()
    drag(canvasElement(), [50, 50], [50, 50])

    fireEvent.change(projectInput(container), {
      target: { files: [new File([JSON.stringify(makeProject('shared.mts', '#123456'))], 'shared.mts', { type: 'application/json' })] },
    })
    await waitFor(() => expect(tabs(container)).toHaveLength(2))
    expect(activeTabName(container)).toBe('shared.mts')
    expect(container.textContent).toContain('Проект загружен: shared.mts')
  })

  it('replaces an untouched tab when opening the first project', async () => {
    const { container } = renderApp()
    fireEvent.change(projectInput(container), {
      target: { files: [new File([JSON.stringify(makeProject('clean.mts', '#abcdef'))], 'clean.mts', { type: 'application/json' })] },
    })
    await waitFor(() => expect(activeTabName(container)).toBe('clean.mts'))
    expect(tabs(container)).toHaveLength(1)
  })
})
