import { describe, expect, it } from 'vitest'
import { defaultShortcuts, normalizeShortcuts } from './components/ShortcutsModal'

describe('keyboard shortcuts', () => {
  it('does not bind two actions to the same key by default', () => {
    const values = Object.values(defaultShortcuts)
    expect(new Set(values).size).toBe(values.length)
  })

  it('keeps rectangle and the UV overlay on different keys', () => {
    expect(defaultShortcuts.toggleUv).not.toBe(defaultShortcuts.rect)
  })

  it('migrates the old U conflict from stored settings', () => {
    const migrated = normalizeShortcuts({ toggleUv: 'U', rect: 'U' })
    expect(migrated.rect).toBe('U')
    expect(migrated.toggleUv).toBe('Ctrl+U')
  })

  it('preserves an intentional non-conflicting UV binding', () => {
    expect(normalizeShortcuts({ toggleUv: 'Ctrl+U', rect: 'U' }).toggleUv).toBe('Ctrl+U')
  })
})
