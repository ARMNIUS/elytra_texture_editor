import type { Mesh } from 'three'

type Traversable = {
  traverse: (callback: (object: unknown) => void) => void
}

/**
 * Collects meshes from an object tree without relying on `instanceof Mesh`.
 *
 * skinview3d bundles its own three.js (0.156), while the plugin imports the
 * workspace three (0.186). The two copies expose different `Mesh` constructors,
 * so an `instanceof` check silently finds no meshes in the elytra rig. Every
 * three.js version marks meshes with the structural `isMesh` flag, which is
 * what we check instead.
 */
export function collectMeshObjects(root: Traversable): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })
  return meshes
}
