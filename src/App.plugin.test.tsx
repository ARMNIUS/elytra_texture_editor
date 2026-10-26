// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'
import type { EditorPlugin } from '@rawsprite/plugin-api'

let markActivated: () => void = () => {}
const activated = new Promise<void>((resolve) => { markActivated = resolve })
const runCommand = vi.fn()
const deactivate = vi.fn()

const plugin: EditorPlugin = {
  manifest: { id: 'test.plugin', name: 'Test plugin', version: '1.0.0', apiVersion: 1 },
  activate(context) {
    context.commands.register({ id: 'test.plugin.run', label: 'Run plugin command', run: runCommand })
    context.menus.register({
      id: 'test.plugin.file',
      area: 'file',
      label: 'Plugin action',
      commandId: 'test.plugin.run',
    })
    markActivated()
  },
  deactivate,
}

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App plugins={[plugin]} />
    </ContextMenuProvider>,
  )
}

beforeEach(() => {
  runCommand.mockReset()
  deactivate.mockReset()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('plugin menu contributions', () => {
  it('renders a plugin menu item and runs its command', async () => {
    const { container, unmount } = renderApp()
    await activated
    await waitFor(() => expect(container.querySelector('.app-shell')?.getAttribute('data-plugins')).toBe('1'))

    fireEvent.click(screen.getByText('Файл'))
    const item = await screen.findByText('Plugin action')
    fireEvent.click(item)

    await waitFor(() => expect(runCommand).toHaveBeenCalledTimes(1))

    unmount()
    await waitFor(() => expect(deactivate).toHaveBeenCalledTimes(1))
  })
})
