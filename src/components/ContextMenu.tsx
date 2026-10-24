import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ContextMenuItem = {
  label?: string
  shortcut?: string
  icon?: ReactNode
  separator?: boolean
  disabled?: boolean
  checked?: boolean
  danger?: boolean
  action?: () => void
}

type ContextMenuRequest = { x: number; y: number; items: ContextMenuItem[] }
type ContextMenuApi = {
  openContextMenu: (event: MouseEvent | ReactMouseEvent<HTMLElement>, items: ContextMenuItem[]) => void
  openContextMenuAt: (x: number, y: number, items: ContextMenuItem[]) => void
  closeContextMenu: () => void
}

const ContextMenuContext = createContext<ContextMenuApi | null>(null)

export function useContextMenu(): ContextMenuApi {
  const value = useContext(ContextMenuContext)
  if (!value) throw new Error('useContextMenu must be used inside ContextMenuProvider')
  return value
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ContextMenuRequest | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const closeContextMenu = useCallback(() => setRequest(null), [])
  const closeAndRestoreFocus = useCallback(() => {
    setRequest(null)
    const target = restoreFocusRef.current
    restoreFocusRef.current = null
    // Menus opened from a button must hand focus back, otherwise keyboard users
    // are dropped on <body> after Escape or after choosing an item.
    if (target?.isConnected) target.focus()
  }, [])
  const openContextMenuAt = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    const visibleItems = items.filter((item, index) => !(item.separator && (index === 0 || items[index - 1]?.separator)))
    while (visibleItems[visibleItems.length - 1]?.separator) visibleItems.pop()
    if (!visibleItems.length) return
    if (document.activeElement instanceof HTMLElement) restoreFocusRef.current = document.activeElement
    const estimatedHeight = visibleItems.reduce((height, item) => height + (item.separator ? 7 : 25), 8)
    setRequest({
      x: Math.max(4, Math.min(x, window.innerWidth - 244)),
      y: Math.max(4, Math.min(y, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 8) - 4)),
      items: visibleItems,
    })
  }, [])
  const openContextMenu = useCallback((event: MouseEvent | ReactMouseEvent<HTMLElement>, items: ContextMenuItem[]) => {
    event.preventDefault()
    event.stopPropagation()
    openContextMenuAt(event.clientX, event.clientY, items)
  }, [openContextMenuAt])

  useEffect(() => {
    if (!request) return
    const getEnabledItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('.classic-context-item:not(:disabled)') ?? [])
    // Context menus in desktop graphics editors are keyboard-friendly as well as mouse-friendly.
    getEnabledItems()[0]?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeContextMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAndRestoreFocus()
        return
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const items = getEnabledItems()
        if (!items.length) return
        event.preventDefault()
        const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
        let nextIndex = currentIndex
        if (event.key === 'Home') nextIndex = 0
        else if (event.key === 'End') nextIndex = items.length - 1
        else if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1 + items.length) % items.length
        else nextIndex = (currentIndex <= 0 ? items.length : currentIndex) - 1
        items[nextIndex]?.focus()
      }
    }
    const onScroll = () => closeContextMenu()
    const onResize = () => closeContextMenu()
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', closeContextMenu)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', closeContextMenu)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [request, closeContextMenu, closeAndRestoreFocus])

  const api = { openContextMenu, openContextMenuAt, closeContextMenu }
  return (
    <ContextMenuContext.Provider value={api}>
      {children}
      {request && createPortal(
        <div
          ref={menuRef}
          className="classic-context-menu"
          role="menu"
          style={{ left: request.x, top: request.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {request.items.map((item, index) => item.separator
            ? <div key={`separator-${index}`} className="classic-context-separator" role="separator" />
            : <button
                key={`${item.label ?? 'item'}-${index}`}
                type="button"
                role="menuitem"
                className={`classic-context-item ${item.danger ? 'context-item-danger' : ''} ${item.checked ? 'context-item-checked' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  closeAndRestoreFocus()
                  item.action?.()
                }}
              >
                <span className="context-item-icon">{item.checked ? <span className="context-check">✓</span> : item.icon}</span>
                <span className="context-item-label">{item.label}</span>
                {item.shortcut && <span className="context-item-shortcut">{item.shortcut}</span>}
              </button>)}
        </div>,
        document.body,
      )}
    </ContextMenuContext.Provider>
  )
}
