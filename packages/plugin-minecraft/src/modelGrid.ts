import { Vector2 } from 'three'
import type { Material } from 'three'

export type ModelGridHandle = {
  setVisible: (visible: boolean) => void
  setSize: (width: number, height: number) => void
  dispose: () => void
}

type GridShader = {
  uniforms: Record<string, { value: unknown }>
}

/**
 * A single UV pixel-grid implementation for every imported model. The grid is
 * generated in the fragment shader from the mesh's raw UVs, so it follows the
 * surface at every camera angle and cannot develop seams between faces.
 */
export function installModelGrid(material: Material, width: number, height: number, visible: boolean): ModelGridHandle {
  const state = {
    shader: null as GridShader | null,
    visible,
    width,
    height,
  }
  const previousCompile = material.onBeforeCompile
  const previousKey = material.customProgramCacheKey
  if ('alphaTest' in material) (material as { alphaTest: number }).alphaTest = 0
  if ('transparent' in material) (material as { transparent: boolean }).transparent = true
  if ('depthWrite' in material) (material as { depthWrite: boolean }).depthWrite = true
  material.defines = { ...(material.defines ?? {}), USE_UV: '' }
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.call(material, shader, renderer)
    shader.uniforms.uRawSpriteGridSize = { value: new Vector2(state.width, state.height) }
    shader.uniforms.uRawSpriteGridOpacity = { value: state.visible ? 0.42 : 0 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRawSpriteGridUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRawSpriteGridUv = vUv;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vRawSpriteGridUv;\nuniform vec2 uRawSpriteGridSize;\nuniform float uRawSpriteGridOpacity;',
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        vec2 rawSpriteGridCoord = vRawSpriteGridUv * uRawSpriteGridSize;
        vec2 rawSpriteGridWidth = max(fwidth(rawSpriteGridCoord), vec2(0.0001));
        vec2 rawSpriteGridLine = abs(fract(rawSpriteGridCoord - 0.5) - 0.5) / rawSpriteGridWidth;
        float rawSpriteGridAlpha = (1.0 - min(min(rawSpriteGridLine.x, rawSpriteGridLine.y), 1.0)) * uRawSpriteGridOpacity;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.9, 0.96, 1.0), rawSpriteGridAlpha);
        gl_FragColor.a = max(gl_FragColor.a, rawSpriteGridAlpha);`,
      )
    state.shader = shader as GridShader
  }
  material.customProgramCacheKey = () => 'rawsprite-uv-grid-v1'
  material.needsUpdate = true

  return {
    setVisible(next) {
      state.visible = next
      if (state.shader) state.shader.uniforms.uRawSpriteGridOpacity.value = next ? 0.42 : 0
    },
    setSize(nextWidth, nextHeight) {
      state.width = nextWidth
      state.height = nextHeight
      if (state.shader) {
        const size = state.shader.uniforms.uRawSpriteGridSize.value as Vector2
        size.set(nextWidth, nextHeight)
      }
    },
    dispose() {
      material.onBeforeCompile = previousCompile
      material.customProgramCacheKey = previousKey
      material.needsUpdate = true
      state.shader = null
    },
  }
}
