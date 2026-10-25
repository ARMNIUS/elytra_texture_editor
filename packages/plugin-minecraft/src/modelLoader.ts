import { NearestFilter, SRGBColorSpace, TextureLoader } from 'three'
import type { Material, Object3D, Texture } from 'three'
import { BBModelLoader } from 'three-blockbench'
import { BedrockModel } from '@bedrock-viewer/model-viewer'

export type LoadedModelKind = 'bbmodel' | 'bedrock'

export type LoadedModel = {
  kind: LoadedModelKind
  name: string
  object3D: Object3D
  /** Updates the texture for formats that keep a single material (currently Bedrock). */
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
    if (textureUrl) await updateTexture(textureUrl)
    return {
      kind,
      name: fileName.replace(/\.[^.]+$/, ''),
      object3D: model.scene,
      updateTexture,
      dispose: () => { texture?.dispose(); model.dispose() },
    }
  }

  const parsed = JSON.parse(text) as { 'minecraft:geometry'?: unknown }
  const geometry = parsed['minecraft:geometry']
  if (!geometry) throw new Error('В файле нет minecraft:geometry')

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
    updateTexture: (next) => model.setTexture(next),
    dispose: () => model.dispose(),
  }
}
