// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import WelcomeDialog from '@rawsprite/editor-ui/WelcomeDialog'

describe('WelcomeDialog', () => {
  it('offers create, open and PNG import actions', () => {
    const onCreate = vi.fn()
    const onOpen = vi.fn()
    const onImportPng = vi.fn()
    render(
      <WelcomeDialog
        open
        appName="RawSprite"
        icon="app.ico"
        onCreate={onCreate}
        onOpen={onOpen}
        onImportPng={onImportPng}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('RawSprite')).toBeTruthy()
    fireEvent.click(screen.getByText('Создать проект'))
    fireEvent.click(screen.getByText('Открыть проект'))
    fireEvent.click(screen.getByText('Импортировать PNG'))
    expect(onCreate).toHaveBeenCalledOnce()
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onImportPng).toHaveBeenCalledOnce()
  })
})
