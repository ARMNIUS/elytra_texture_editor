import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from './App'
import { ContextMenuProvider } from './components/ContextMenu'

// Server rendering exercises the full component tree without a browser: it catches
// broken hooks, missing props and render-time crashes introduced by the layer,
// selection and palette refactors.
function renderApp(): string {
  return renderToString(
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>,
  )
}

function renderRawSprite(): string {
  return renderToString(
    <ContextMenuProvider>
      <App mode="rawsprite" />
    </ContextMenuProvider>,
  )
}

describe('App shell', () => {
  it('renders the workspace with palette, layers and tools', () => {
    const html = renderApp()
    expect(html).toContain('Minecraft')
    expect(html).toContain('ПАЛИТРА')
    expect(html).toContain('СЛОИ')
    expect(html).toContain('Слой 1')
    expect(html).toContain('Выделение')
    expect(html).toContain('Прямоугольник')
    expect(html).toContain('Эллипс')
  })

  it('keeps the dock controls for palette management', () => {
    const html = renderApp()
    expect(html).toContain('Действия с палитрой')
    expect(html).toContain('Палитра заблокирована от изменений')
    expect(html).toContain('Текущий цвет')
    expect(html).not.toContain('Конфигуратор палитры')
  })

  it('renders one layer row per document layer and the opacity control', () => {
    const html = renderApp()
    expect(html).toContain('Прозрачность активного слоя')
    expect(html).toContain('Новый слой')
    expect(html).toContain('Объединить с нижним слоем')
  })

  it('keeps the workspace free of the removed toolbar clutter', () => {
    const html = renderApp()
    // Breadcrumb, zoom slider and the duplicated top-right action buttons are gone.
    expect(html).not.toContain('PROJECT')
    expect(html).not.toContain('Масштаб холста')
    expect(html).not.toContain('Сохранить проект</span>')
    expect(html).not.toContain('Загрузить скин')
    expect(html).not.toContain('color-editor-window')
  })

  it('renders a Minecraft-free RawSprite shell', () => {
    const html = renderRawSprite()
    expect(html).toContain('Raw')
    expect(html).toContain('PIXEL ART EDITOR')
    expect(html).toContain('64 by 64 pixel texture canvas')
    expect(html).not.toContain('ПРЕДПРОСМОТР')
    expect(html).not.toContain('3D EDIT')
    expect(html).not.toContain('Загрузить скин')
  })
})
