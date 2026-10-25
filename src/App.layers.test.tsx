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
  localStorage.clear()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:palette-test'), revokeObjectURL: vi.fn() })
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
    expect(screen.getByTitle('Палитра заблокирована от изменений (A)')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Действия с палитрой'))
    for (const label of ['Новая палитра', 'Дублировать палитру', 'Переименовать палитру', 'Импортировать палитру…', 'Экспортировать .gpl…', 'Удалить палитру']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('exports the current palette as .gpl', () => {
    renderApp()
    fireEvent.click(screen.getByLabelText('Действия с палитрой'))
    fireEvent.click(screen.getByText('Экспортировать .gpl…'))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('starts locked but still allows explicit color additions', () => {
    const { container } = renderApp()
    expect(screen.getByTitle('Палитра заблокирована от изменений (A)')).toBeTruthy()
    expect((screen.getByRole('button', { name: /В палитру/ }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.change(screen.getByLabelText('HEX текущего цвета'), { target: { value: '#123456' } })
    fireEvent.click(screen.getByLabelText('Добавить цвет в палитру'))
    expect(screen.getByRole('option', { name: /Minecraft · Classic — копия/ })).toBeTruthy()
    expect(screen.getByTitle('Палитра заблокирована от изменений (A)')).toBeTruthy()
    const swatches = container.querySelectorAll('.ase-swatch-grid .swatch:not(.swatch-add)')
    expect((swatches[swatches.length - 1] as HTMLElement).style.backgroundColor).toBe('rgb(18, 52, 86)')
  })

  it('selects and edits only one of several duplicate swatches', () => {
    localStorage.setItem('mts-user-palettes-v1', JSON.stringify([
      { name: 'Dupes', colors: ['#ff0000', '#ff0000', '#00ff00'] },
    ]))
    localStorage.setItem('mts-active-palette-v1', 'Dupes')
    const { container } = renderApp()
    const swatches = container.querySelectorAll('.ase-swatch-grid .swatch:not(.swatch-add)')
    expect(swatches).toHaveLength(3)

    fireEvent.click(swatches[1] as HTMLElement)
    expect(container.querySelectorAll('.swatch-active')).toHaveLength(1)
    expect(swatches[1].classList.contains('swatch-active')).toBe(true)

    fireEvent.click(screen.getByTitle('Палитра заблокирована от изменений (A)'))
    fireEvent.change(screen.getByLabelText('HEX текущего цвета'), { target: { value: '#0000ff' } })
    const edited = container.querySelectorAll('.ase-swatch-grid .swatch:not(.swatch-add)')
    expect((edited[0] as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)')
    expect((edited[1] as HTMLElement).style.backgroundColor).toBe('rgb(0, 0, 255)')
    expect((edited[2] as HTMLElement).style.backgroundColor).toBe('rgb(0, 255, 0)')
  })

  it('locks the palette with the button and the A key', () => {
    renderApp()
    fireEvent.keyDown(window, { key: 'a' })
    expect(screen.getByTitle('Палитра доступна для редактирования (A)')).toBeTruthy()
    expect((screen.getByRole('button', { name: /В палитру/ }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.keyDown(window, { key: 'a' })
    expect(screen.getByTitle('Палитра заблокирована от изменений (A)')).toBeTruthy()
  })

  it('does not overwrite a selected swatch while the palette is locked', () => {
    renderApp()
    fireEvent.click(screen.getByTitle(/^1: #171717/))
    fireEvent.change(screen.getByLabelText('HEX текущего цвета'), { target: { value: '#ff0000' } })
    expect(screen.queryByRole('option', { name: /копия/ })).toBeNull()

    fireEvent.click(screen.getByTitle('Палитра заблокирована от изменений (A)'))
    fireEvent.click(screen.getByTitle(/^1: #171717/))
    fireEvent.change(screen.getByLabelText('HEX текущего цвета'), { target: { value: '#00ff00' } })
    expect(screen.getByRole('option', { name: /Minecraft · Classic — копия/ })).toBeTruthy()
  })

  it('deletes a specific swatch from its right-click menu', () => {
    const { container } = renderApp()
    const swatches = container.querySelectorAll('.ase-swatch-grid .swatch:not(.swatch-add)')
    expect(swatches).toHaveLength(24)
    fireEvent.contextMenu(swatches[0] as HTMLElement)
    fireEvent.click(screen.getByText('Удалить этот цвет'))
    expect(container.querySelectorAll('.ase-swatch-grid .swatch:not(.swatch-add)')).toHaveLength(23)
  })
})
