// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'
import { TEXTURE_PIXEL_COUNT } from '@rawsprite/core/layers'

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
  it('saves a version 3 document with explicit canvas size', async () => {
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
      width: number
      height: number
      activeLayerId: string
      layers: Array<{ name: string; pixels: string[]; visible: boolean; opacity: number }>
      settings: { tool: string }
    }

    expect(saved.format).toBe('minecraft-texture-studio-project')
    expect(saved.version).toBe(3)
    expect(saved.width).toBe(64)
    expect(saved.height).toBe(32)
    expect(saved.layers).toHaveLength(2)
    expect(saved.layers[0].pixels).toHaveLength(TEXTURE_PIXEL_COUNT)
    expect(saved.layers.every((layer) => layer.visible && layer.opacity === 100)).toBe(true)
    expect(saved.layers.some((layer) => layer.name === 'Слой 2')).toBe(true)
    expect(saved.activeLayerId).toMatch(/./)
    expect(saved.settings.tool).toBe('brush')
  })

  it('creates a custom-sized sprite and saves its dimensions', async () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByText('Файл'))
    fireEvent.click(screen.getByText('Новый проект…'))
    fireEvent.change(screen.getByLabelText('Ширина холста'), { target: { value: '128' } })
    fireEvent.change(screen.getByLabelText('Высота холста'), { target: { value: '256' } })
    fireEvent.click(screen.getByText('Создать'))

    expect(screen.queryByLabelText('Ширина холста')).toBeNull()
    expect(screen.getByText('Новый холст 128×256')).toBeTruthy()
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).width).toBe(128)
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).height).toBe(256)

    const captured = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls
    captured.length = 0
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const saved = JSON.parse(await (captured[0][0] as Blob).text()) as {
      version: number
      width: number
      height: number
      layers: Array<{ pixels: string[] }>
    }
    expect(saved.version).toBe(3)
    expect(saved.width).toBe(128)
    expect(saved.height).toBe(256)
    expect(saved.layers[0].pixels).toHaveLength(128 * 256)
  })

  it('loads a version 3 document with a non-64×32 canvas', async () => {
    const { container } = renderApp()
    const document = {
      format: 'minecraft-texture-studio-project',
      version: 3,
      filename: 'sprite-16x8.mts',
      width: 16,
      height: 8,
      activeLayerId: 'layer-a',
      layers: [{
        id: 'layer-a',
        name: 'Слой 1',
        visible: true,
        opacity: 100,
        pixels: Array.from({ length: 16 * 8 }, () => '#123456'),
      }],
      settings: { currentColor: '#123456', tool: 'brush', viewMode: '2d' },
      shortcuts: {},
      palettes: { userPalettes: [], savedColors: [], activePalette: 'Minecraft · Classic' },
    }
    const file = new File([JSON.stringify(document)], 'sprite-16x8.mts', { type: 'application/json' })
    fireEvent.change(projectInput(container), { target: { files: [file] } })

    await waitFor(() => expect(container.querySelectorAll('.layer-row')).toHaveLength(1))
    expect(container.textContent).toContain('Проект загружен: sprite-16x8.mts')
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).width).toBe(16)
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).height).toBe(8)
    expect(container.querySelector('.pixel-grid-overlay')).toBeNull()
    fireEvent.click(screen.getByLabelText('Сетка пикселей 2D'))
    expect(container.querySelector('.pixel-grid-overlay')?.getAttribute('viewBox')).toBe('0 0 16 8')
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

    await waitFor(() => expect(container.textContent).toContain('Проект загружен: legacy.mts'))
    expect(container.querySelectorAll('.layer-row')).toHaveLength(1)
    expect(container.querySelector('.document-tab-active .document-tab-name')?.textContent).toBe('legacy.png')
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
