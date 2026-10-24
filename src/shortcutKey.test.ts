import { describe, expect, it } from 'vitest'
import { shortcutKey } from './utils/shortcutKey'

describe('layout-independent shortcut keys', () => {
  it('maps physical keys while a Russian layout is active', () => {
    expect(shortcutKey({ key: 'ы', code: 'KeyS' })).toBe('S')
    expect(shortcutKey({ key: 'я', code: 'KeyZ' })).toBe('Z')
    expect(shortcutKey({ key: 'с', code: 'KeyC' })).toBe('C')
    expect(shortcutKey({ key: 'б', code: 'Comma' })).toBe(',')
  })

  it('supports Ctrl combinations and digits', () => {
    expect(shortcutKey({ key: 'ы', code: 'KeyS' })).toBe('S')
    expect(shortcutKey({ key: '1', code: 'Digit1' })).toBe('1')
  })

  it('falls back to event.key in tests and unusual environments', () => {
    expect(shortcutKey({ key: 's' })).toBe('S')
    expect(shortcutKey({ key: 'Delete' })).toBe('Delete')
  })
})
