// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

type FakePreviewProps = { onResizeCanvas?: (width: number, height: number) => void }

function FakePreview({ onResizeCanvas }: FakePreviewProps) {
  return <button type="button" onClick={() => onResizeCanvas?.(64, 64)}>resize-model</button>
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:resize-test'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('model canvas resize', () => {
  it('resizes the canvas to the model texture and restores it with undo', async () => {
    const { container } = render(
      <ContextMenuProvider>
        <App previewComponent={FakePreview} />
      </ContextMenuProvider>,
    )
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).width).toBe(64)
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).height).toBe(32)

    fireEvent.click(screen.getByText('resize-model'))
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).width).toBe(64)
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).height).toBe(64)

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const saved = JSON.parse(await (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0].text()) as {
      width: number
      height: number
    }
    expect(saved.width).toBe(64)
    expect(saved.height).toBe(64)

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect((container.querySelector('.pixel-canvas') as HTMLCanvasElement).height).toBe(32)
  })
})
