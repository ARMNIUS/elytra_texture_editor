import { describe, expect, it } from 'vitest'
import { detectModelKind } from '@rawsprite/plugin-minecraft/modelLoader'

describe('model format detection', () => {
  it('recognises Blockbench projects by extension and payload', () => {
    expect(detectModelKind('sword.bbmodel', '')).toBe('bbmodel')
    expect(detectModelKind('model.json', '{"elements":[],"outliner":[]}')).toBe('bbmodel')
  })

  it('recognises Bedrock geometry', () => {
    expect(detectModelKind('frog.geo.json', '{"format_version":"1.16.0","minecraft:geometry":[]}')).toBe('bedrock')
    expect(detectModelKind('frog.json', '{"format_version":"1.16.0","minecraft:geometry":[]}')).toBe('bedrock')
  })

  it('rejects unrelated JSON', () => {
    expect(detectModelKind('project.json', '{"format":"rawsprite-project"}')).toBeNull()
  })
})
