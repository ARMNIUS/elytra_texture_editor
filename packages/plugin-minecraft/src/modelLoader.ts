import { NearestFilter, SRGBColorSpace, TextureLoader } from 'three'
import type { Material, Object3D, Texture } from 'three'
import { BBModelLoader } from 'three-blockbench'
import { BedrockModel } from '@bedrock-viewer/model-viewer'

export type LoadedModelKind = 'bbmodel' | 'bedrock'

export type LoadedModel = {
  kind: LoadedModelKind
  name: string
  object3D: Object3D
  /** Pixels per world unit (Blockbench uses 1/16; Bedrock geometry is already in pixels). */
  unitScale: number
  textureWidth: number
  textureHeight: number
  /** Updates the texture for models whose texture is supplied by the editor canvas. */
  updateTexture?: (textureUrl: string) => Promise<void>
  dispose: () => void
}

export function detectModelKind(fileName: string, text: string): LoadedModelKind | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.bbmodel')) return 'bbmodel'
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null && 'minecraft:geometry' in parsed) return 'bedrock'
    if (typeof parsed === 'object' && parsed !== null && 'elements' in parsed && 'outliner' in parsed) return 'bbmodel'
  } catch {
    return null
  }
  return lower.endsWith('.geo.json') ? 'bedrock' : null
}

async function loadTexture(url: string): Promise<Texture> {
  const texture = await new TextureLoader().loadAsync(url)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/** Loads a Blockbench project or Bedrock geometry file from text. */
export async function loadModelFromText(
  fileName: string,
  text: string,
  textureUrl?: string,
): Promise<LoadedModel> {
  const kind = detectModelKind(fileName, text)
  if (!kind) throw new Error('Неизвестный формат модели. Нужен .bbmodel или Bedrock .geo.json')

  if (kind === 'bbmodel') {
    const model = await new BBModelLoader().parseAsync(text)
    const resolution = (model.document as { resolution?: { width?: number; height?: number } }).resolution
    let texture: Texture | null = null
    const updateTexture = async (url: string) => {
      texture?.dispose()
      texture = await loadTexture(url)
      for (const material of model.materials as Material[]) {
        if ('map' in material) {
          material.map = texture
          material.needsUpdate = true
        }
      }
    }
    // A .bbmodel normally carries its own texture. Keep it: replacing it with the
    // current (possibly different-sized) canvas would squash the model texture.
    const hasEmbeddedTexture = model.textures.size > 0
    if (textureUrl && !hasEmbeddedTexture) await updateTexture(textureUrl)
    return {
      kind,
      name: fileName.replace(/\.[^.]+$/, ''),
      object3D: model.scene,
      unitScale: 1 / 16,
      textureWidth: resolution?.width ?? 64,
      textureHeight: resolution?.height ?? 64,
      // Only models without an embedded texture follow the canvas while drawing.
      updateTexture: hasEmbeddedTexture ? undefined : updateTexture,
      dispose: () => { texture?.dispose(); model.dispose() },
    }
  }

  const parsed = JSON.parse(text) as { 'minecraft:geometry'?: unknown }
  const geometry = parsed['minecraft:geometry']
  if (!geometry) throw new Error('В файле нет minecraft:geometry')

  const geometryList = Array.isArray(geometry) ? geometry : [geometry]
  const description = (geometryList[0] as { description?: { texture_width?: number; texture_height?: number } })?.description
  const names = BedrockModel.listGeometryNames(parsed as Parameters<typeof BedrockModel.load>[0]['geometry'])
  const model = await BedrockModel.load({
    geometry: parsed as Parameters<typeof BedrockModel.load>[0]['geometry'],
    geometryName: names[0],
    texture: textureUrl,
  })
  return {
    kind,
    name: names[0] ?? fileName.replace(/\.[^.]+$/, ''),
    object3D: model.object3D,
    unitScale: 1,
    textureWidth: description?.texture_width ?? 64,
    textureHeight: description?.texture_height ?? 64,
    updateTexture: (next) => model.setTexture(next),
    dispose: () => model.dispose(),
  }
}
