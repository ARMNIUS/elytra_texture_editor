// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

const { savePathMock, invokeMock, closeHandlers, destroyMock } = vi.hoisted(() => ({
  savePathMock: vi.fn(),
  invokeMock: vi.fn(),
  closeHandlers: [] as Array<(event: { preventDefault: () => void }) => void>,
  destroyMock: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: savePathMock,
  open: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (handler: (event: { preventDefault: () => void }) => void) => {
      closeHandlers.push(handler)
      return () => {}
    },
    destroy: destroyMock,
  }),
}))

const TRANSPARENT = '#00000000'
const PAINT = '#4ba3ff'

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, buttons: 1, clientX: from[0], clientY: from[1] })
  fireEvent.pointerMove(canvas, { pointerId: 1, buttons: 1, clientX: to[0], clientY: to[1] })
  fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: to[0], clientY: to[1] })
}

function paintPixel(index: number, from: [number, number], to: [number, number]) {
  const canvas = screen.getByLabelText('64 by 32 pixel texture canvas') as HTMLCanvasElement
  drag(canvas, from, to)
  return index
}

beforeEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  ;(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
  closeHandlers.length = 0
  savePathMock.mockReset()
  invokeMock.mockReset()
  destroyMock.mockReset()
  invokeMock.mockResolvedValue(undefined)
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 320, width: 640, height: 320, toJSON: () => ({}),
  })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect
  Object.assign(HTMLElement.prototype, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true) })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
})

describe('application close', () => {
  it('saves every dirty tab before destroying the window', async () => {
    renderApp()

    paintPixel(5 * 64 + 5, [50, 50], [50, 50])
    fireEvent.click(screen.getByLabelText('Новый проект'))
    fireEvent.click(screen.getByText('Создать'))
    paintPixel(20 * 64 + 20, [200, 200], [200, 200])

    await waitFor(() => expect(closeHandlers).toHaveLength(1))
    const closeEvent = { preventDefault: vi.fn() }
    closeHandlers[0](closeEvent)
    expect(closeEvent.preventDefault).toHaveBeenCalled()

    const dialog = await screen.findByRole('alertdialog', { name: 'Закрытие приложения' })
    expect(within(dialog).getByText(/2 проектах/)).toBeTruthy()

    savePathMock
      .mockResolvedValueOnce('C:\\tmp\\first.mts')
      .mockResolvedValueOnce('C:\\tmp\\second.mts')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(destroyMock).toHaveBeenCalledTimes(1))
    expect(savePathMock).toHaveBeenCalledTimes(2)

    const writes = invokeMock.mock.calls
      .filter(([command]) => command === 'write_text_file')
      .map(([, args]) => args as { path: string; contents: string })
    expect(writes).toHaveLength(2)
    expect(writes.map((write) => write.path)).toEqual(['C:\\tmp\\first.mts', 'C:\\tmp\\second.mts'])

    const saved = writes.map((write) => JSON.parse(write.contents) as { filename: string; layers: Array<{ pixels: string[] }> })
    expect(saved[0].layers[0].pixels[5 * 64 + 5]).toBe(PAINT)
    expect(saved[0].layers[0].pixels[20 * 64 + 20]).toBe(TRANSPARENT)
    expect(saved[1].layers[0].pixels[20 * 64 + 20]).toBe(PAINT)
    expect(saved[1].layers[0].pixels[5 * 64 + 5]).toBe(TRANSPARENT)
  })

  it('does not destroy the window when a save is cancelled', async () => {
    renderApp()

    paintPixel(5 * 64 + 5, [50, 50], [50, 50])
    fireEvent.click(screen.getByLabelText('Новый проект'))
    fireEvent.click(screen.getByText('Создать'))
    paintPixel(20 * 64 + 20, [200, 200], [200, 200])

    await waitFor(() => expect(closeHandlers).toHaveLength(1))
    closeHandlers[0]({ preventDefault: vi.fn() })
    const dialog = await screen.findByRole('alertdialog', { name: 'Закрытие приложения' })

    savePathMock
      .mockResolvedValueOnce('C:\\tmp\\first.mts')
      .mockResolvedValueOnce(null)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(savePathMock).toHaveBeenCalledTimes(2))
    expect(destroyMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: 'Закрытие приложения' })).toBeTruthy()
  })

  it('saves the tab being closed instead of the active tab', async () => {
    renderApp()

    paintPixel(5 * 64 + 5, [50, 50], [50, 50])
    fireEvent.click(screen.getByLabelText('Новый проект'))
    fireEvent.click(screen.getByText('Создать'))
    paintPixel(20 * 64 + 20, [200, 200], [200, 200])

    // The second tab is active; close the first, dirty tab from its close button.
    fireEvent.click(screen.getByLabelText('Закрыть elytra.png'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Закрытие проекта' })
    savePathMock.mockResolvedValueOnce('C:\\tmp\\closed.mts')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(savePathMock).toHaveBeenCalledTimes(1))
    const writes = invokeMock.mock.calls.filter(([command]) => command === 'write_text_file')
    expect(writes).toHaveLength(1)
    expect((writes[0][1] as { path: string }).path).toBe('C:\\tmp\\closed.mts')
    const saved = JSON.parse((writes[0][1] as { contents: string }).contents) as { layers: Array<{ pixels: string[] }> }
    expect(saved.layers[0].pixels[5 * 64 + 5]).toBe(PAINT)
    expect(saved.layers[0].pixels[20 * 64 + 20]).toBe(TRANSPARENT)

    await waitFor(() => expect(screen.queryByLabelText('Закрыть elytra.png')).toBeNull())
    expect(document.querySelector('.document-tab-active .document-tab-name')?.textContent).toBe('Без названия 1.mts')
    expect(destroyMock).not.toHaveBeenCalled()
  })
})
