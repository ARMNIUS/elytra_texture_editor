// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))
vi.mock('@rawsprite/core/texture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rawsprite/core/texture')>()
  return { ...actual, readImageFile: vi.fn(async () => ({ pixels: ['#ff0000'], width: 1, height: 1 })) }
})

const TRAIT = '#00000000'

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:import-test'),
    revokeObjectURL: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('texture import', () => {
  it('places a small imported image at native size instead of stretching it', async () => {
    const { container } = renderApp()
    const input = container.querySelector('input[accept="image/png,image/*"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['pixel'], 'pixel.png', { type: 'image/png' })] } })

    await waitFor(() => expect(container.textContent).toContain('Импортировано'))
    const createObjectURL = URL.createObjectURL as unknown as Mock
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const blob = createObjectURL.mock.calls.at(-1)?.[0] as Blob
    const saved = JSON.parse(await blob.text()) as { layers: Array<{ pixels: string[] }> }
    const pixels = saved.layers[0].pixels
    expect(pixels).toHaveLength(2048)
    expect(pixels[0]).toBe('#ff0000')
    expect(pixels.filter((pixel) => pixel !== TRAIT)).toHaveLength(1)
  })
})
