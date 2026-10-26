import { describe, expect, it } from 'vitest'
import { collectMeshObjects } from '@rawsprite/plugin-minecraft/meshUtils'

describe('collectMeshObjects', () => {
  it('collects meshes from another three.js copy by isMesh flag', () => {
    const wing = { isMesh: true, name: 'left-wing' }
    const nested = { isMesh: true, name: 'right-wing' }
    const bone = { isMesh: false, name: 'bone' }
    const root = {
      traverse: (visit: (object: unknown) => void) => {
        visit(root)
        visit(bone)
        visit(wing)
        visit(nested)
      },
    }

    const meshes = collectMeshObjects(root).map((mesh) => (mesh as unknown as { name: string }).name)
    expect(meshes).toEqual(['left-wing', 'right-wing'])
  })
})
