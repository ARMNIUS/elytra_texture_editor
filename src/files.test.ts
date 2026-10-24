import { describe, expect, it } from 'vitest'
import { basename, ensureExtension, toPngName, toProjectName } from './utils/files'

describe('file names', () => {
  it('extracts a Windows or POSIX base name', () => {
    expect(basename('C:\\Users\\me\\my project.mts')).toBe('my project.mts')
    expect(basename('/home/me/my project.mts')).toBe('my project.mts')
  })

  it('keeps the requested extension only once', () => {
    expect(ensureExtension('C:\\art\\wing', 'png')).toBe('C:\\art\\wing.png')
    expect(ensureExtension('C:\\art\\wing.PNG', 'png')).toBe('C:\\art\\wing.PNG')
  })

  it('builds project and PNG names from the texture name', () => {
    expect(toProjectName('elytra.png')).toBe('elytra.mts')
    expect(toProjectName('wing.mts')).toBe('wing.mts')
    expect(toPngName('wing.mts')).toBe('wing.png')
  })
})
