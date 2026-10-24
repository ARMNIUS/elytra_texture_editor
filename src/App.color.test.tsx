// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

type SavedProject = { settings: { currentColor: string; secondaryColor: string } }

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

async function saveProject(): Promise<SavedProject> {
  const createObjectURL = URL.createObjectURL as unknown as Mock
  const before = createObjectURL.mock.calls.length
  fireEvent.keyDown(window, { key: 's', ctrlKey: true })
  const blob = createObjectURL.mock.calls[before][0] as Blob
  return JSON.parse(await blob.text()) as SavedProject
}

function openColorEditor() {
  fireEvent.click(screen.getAllByLabelText('Открыть редактор цвета')[0])
  return screen.getByRole('dialog', { name: /Редактор цвета/ })
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
  })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect
  Object.assign(HTMLAnchorElement.prototype, { click: vi.fn() })
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mts-test'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('color editor window', () => {
  it('shows HSV, RGB and alpha sliders plus the A/B comparison', () => {
    renderApp()
    const dialog = openColorEditor()
    for (const label of ['H значение', 'S значение', 'V значение', 'R значение', 'G значение', 'B значение', 'A значение']) {
      expect(screen.getByLabelText(label)).toBeTruthy()
    }
    expect(dialog.querySelectorAll('.color-ab-swatch')).toHaveLength(2)
    expect(dialog.textContent).toContain('A · было')
    expect(dialog.textContent).toContain('B · сейчас')
    expect(dialog.textContent).toContain('#4ba3ff')
  })

  it('applies alpha and returns to the original color through A/B', async () => {
    renderApp()
    const dialog = openColorEditor()
    const alpha = screen.getByLabelText('A значение')
    fireEvent.change(alpha, { target: { value: '128' } })

    const hexField = screen.getByLabelText('HEX/HEXA цвета') as HTMLInputElement
    expect(hexField.value).toBe('#4ba3ff80')

    const saved = await saveProject()
    expect(saved.settings.currentColor).toBe('#4ba3ff80')

    fireEvent.click(screen.getByTitle('Вернуть цвет A'))
    expect((screen.getByLabelText('HEX/HEXA цвета') as HTMLInputElement).value).toBe('#4ba3ff')
    expect(dialog.textContent).toContain('#4ba3ff')
  })

  it('keeps hue and saturation while value is zero', async () => {
    renderApp()
    openColorEditor()
    const hue = screen.getByLabelText('H значение')
    const saturation = screen.getByLabelText('S значение')
    const value = screen.getByLabelText('V значение')

    fireEvent.change(hue, { target: { value: '210' } })
    fireEvent.change(saturation, { target: { value: '80' } })
    fireEvent.change(value, { target: { value: '100' } })
    const tuned = await saveProject()

    fireEvent.change(value, { target: { value: '0' } })
    const black = await saveProject()
    expect(black.settings.currentColor).toBe('#000000')

    fireEvent.change(value, { target: { value: '100' } })
    const restored = await saveProject()
    expect(restored.settings.currentColor).toBe(tuned.settings.currentColor)
  })

  it('accepts an 8-digit HEX value in the palette dock', async () => {
    renderApp()
    const dockHex = screen.getByLabelText('HEX текущего цвета')
    fireEvent.change(dockHex, { target: { value: '#ff000080' } })
    const saved = await saveProject()
    expect(saved.settings.currentColor).toBe('#ff000080')
  })

  it('keeps the RGB channels and sliders when alpha reaches zero', async () => {
    renderApp()
    openColorEditor()
    fireEvent.change(screen.getByLabelText('H значение'), { target: { value: '210' } })
    fireEvent.change(screen.getByLabelText('S значение'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('V значение'), { target: { value: '100' } })
    const tuned = await saveProject()
    expect(tuned.settings.currentColor).toHaveLength(7)

    fireEvent.change(screen.getByLabelText('A значение'), { target: { value: '0' } })
    const transparent = await saveProject()
    // The color is invisible but its RGB survives, so sliders and alpha can be restored.
    expect(transparent.settings.currentColor).toBe(`${tuned.settings.currentColor}00`)
    expect((screen.getByLabelText('H значение') as HTMLInputElement).value).toBe('210')
    expect((screen.getByLabelText('S значение') as HTMLInputElement).value).toBe('80')
    expect((screen.getByLabelText('V значение') as HTMLInputElement).value).toBe('100')

    fireEvent.change(screen.getByLabelText('A значение'), { target: { value: '255' } })
    const restored = await saveProject()
    expect(restored.settings.currentColor).toBe(tuned.settings.currentColor)
  })

  it('closes with Escape and with the close button', () => {
    renderApp()
    openColorEditor()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /Редактор цвета/ })).toBeNull()

    openColorEditor()
    const close = screen.getByLabelText('Закрыть редактор цвета')
    // The title bar used to capture the pointer; the close button must win.
    fireEvent.pointerDown(close, { pointerId: 1, button: 0, buttons: 1 })
    fireEvent.pointerUp(close, { pointerId: 1, button: 0 })
    fireEvent.click(close)
    expect(screen.queryByRole('dialog', { name: /Редактор цвета/ })).toBeNull()
  })

  it('does not show instructional text at the bottom of the window', () => {
    renderApp()
    const dialog = openColorEditor()
    expect(dialog.querySelector('.color-editor-hint')).toBeNull()
    expect(dialog.textContent).not.toContain('Клик по A')
  })
})
