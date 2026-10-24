// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

// The WebGL preview is irrelevant for document-state tests and jsdom has no canvas.
vi.mock('./components/ElytraViewer', () => ({ default: () => <div data-testid="viewer-stub" /> }))

function renderApp() {
  return render(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

function layerRows(container: HTMLElement) {
  return container.querySelectorAll('.layer-row')
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('layers panel integration', () => {
  it('adds a layer and undoes it', () => {
    const { container } = renderApp()
    expect(layerRows(container)).toHaveLength(1)

    fireEvent.click(screen.getByTitle('Новый слой'))
    expect(layerRows(container)).toHaveLength(2)
    expect(container.textContent).toContain('Слой 2')

    fireEvent.click(screen.getAllByTitle('Отменить')[0])
    expect(layerRows(container)).toHaveLength(1)
    expect(container.textContent).not.toContain('Слой 2')
  })

  it('duplicates and deletes the active layer', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Дублировать активный слой'))
    expect(layerRows(container)).toHaveLength(2)
    expect(container.textContent).toContain('копия')

    fireEvent.click(screen.getByTitle('Удалить активный слой'))
    expect(layerRows(container)).toHaveLength(1)
    expect(container.textContent).not.toContain('копия')
  })

  it('toggles visibility and blocks accidental edits of hidden layers', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByTitle('Скрыть слой'))
    expect(container.querySelectorAll('.layer-row-hidden')).toHaveLength(1)
    expect(container.textContent).toContain('Слой скрыт')

    fireEvent.click(screen.getByTitle('Показать слой'))
    expect(container.querySelectorAll('.layer-row-hidden')).toHaveLength(0)
  })

  it('renames a layer by double clicking its name', () => {
    const { container } = renderApp()
    const name = container.querySelector('.layer-name')
    expect(name).not.toBeNull()
    fireEvent.doubleClick(name!)

    const input = screen.getByLabelText('Имя слоя')
    fireEvent.change(input, { target: { value: 'Крылья' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(container.textContent).toContain('Крылья')
    expect(container.querySelector('.layer-name')?.textContent).toBe('Крылья')
  })

  it('applies layer opacity and shows the badge', () => {
    const { container } = renderApp()
    const slider = screen.getByLabelText('Прозрачность активного слоя')
    fireEvent.change(slider, { target: { value: '40' } })
    expect(container.textContent).toContain('40%')
  })

  it('keeps the palette manager inside the dock', () => {
    const { container } = renderApp()
    expect(container.querySelector('.palette-config-modal')).toBeNull()
    for (const title of ['Новая палитра', 'Дублировать палитру', 'Переименовать палитру', 'Удалить палитру', 'Импорт палитры (.gpl/.hex/.txt/.json)', 'Экспорт палитры (.gpl)']) {
      expect(screen.getAllByTitle(title).length).toBeGreaterThan(0)
    }
  })
})
