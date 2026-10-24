// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'
import { TEXTURE_PIXEL_COUNT } from './utils/layers'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

function projectInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[accept=".mts,.json,application/json"]')
  expect(input).not.toBeNull()
  return input as HTMLInputElement
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
    x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
  })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect
  Object.assign(HTMLAnchorElement.prototype, { click: vi.fn() })
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:mts-test'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('project documents', () => {
  it('saves a version 2 document with the full layer stack', async () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Новый слой'))
    expect(container.querySelectorAll('.layer-row')).toHaveLength(2)

    const captured = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls
    captured.length = 0
    // The toolbar save button was removed; Ctrl+S is the canonical save path.
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    expect(captured).toHaveLength(1)
    const blob = captured[0][0] as Blob
    const saved = JSON.parse(await blob.text()) as {
      format: string
      version: number
      activeLayerId: string
      layers: Array<{ name: string; pixels: string[]; visible: boolean; opacity: number }>
      settings: { tool: string }
    }

    expect(saved.format).toBe('minecraft-texture-studio-project')
    expect(saved.version).toBe(2)
    expect(saved.layers).toHaveLength(2)
    expect(saved.layers[0].pixels).toHaveLength(TEXTURE_PIXEL_COUNT)
    expect(saved.layers.every((layer) => layer.visible && layer.opacity === 100)).toBe(true)
    expect(saved.layers.some((layer) => layer.name === 'Слой 2')).toBe(true)
    expect(saved.activeLayerId).toMatch(/./)
    expect(saved.settings.tool).toBe('brush')
  })

  it('loads a version 1 document into a single layer', async () => {
    const { container } = renderApp()
    const legacy = {
      format: 'minecraft-texture-studio-project',
      version: 1,
      filename: 'legacy.png',
      pixels: Array.from({ length: TEXTURE_PIXEL_COUNT }, () => '#123456'),
      settings: { currentColor: '#123456', tool: 'fill', viewMode: '2d' },
      shortcuts: {},
      palettes: { userPalettes: [], savedColors: [], activePalette: 'Minecraft · Classic' },
    }
    const file = new File([JSON.stringify(legacy)], 'legacy.mts', { type: 'application/json' })
    fireEvent.change(projectInput(container), { target: { files: [file] } })

    await waitFor(() => expect(container.querySelectorAll('.layer-row')).toHaveLength(1))
    expect(container.textContent).toContain('Проект загружен: legacy.mts')
    expect((container.querySelector('.document-title input') as HTMLInputElement).value).toBe('legacy.png')
    // The legacy tool id survives the mapping to the new tool union.
    expect(container.textContent).toContain('Заливка')
  })

  it('rejects a document with a broken layer payload', async () => {
    const { container } = renderApp()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = {
      format: 'minecraft-texture-studio-project',
      version: 2,
      filename: 'broken.mts',
      layers: [{ name: 'bad', pixels: ['#fff'] }],
      settings: {},
    }
    const file = new File([JSON.stringify(broken)], 'broken.mts', { type: 'application/json' })
    fireEvent.change(projectInput(container), { target: { files: [file] } })

    await waitFor(() => expect(container.textContent).toContain('Ошибка проекта'))
    expect(container.querySelectorAll('.layer-row')).toHaveLength(1)
    expect(errorSpy).toHaveBeenCalled()
  })
})
