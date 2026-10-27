import { describe, expect, it } from 'vitest'
import { createNameAllocator, toCamelCase } from './naming'

describe('toCamelCase', () => {
  it.each([
    ['Lerp', 'lerp'],
    ['One Minus', 'oneMinus'],
    ['Sample Texture 2D', 'sampleTexture2d'],
    ['AA Step', 'aaStep'],
    ['Normal From Height', 'normalFromHeight'],
    ['sRGB to Linear', 'srgbToLinear'],
  ])('turns %s into %s', (label, expected) => {
    expect(toCamelCase(label)).toBe(expected)
  })

  it('falls back to "node" when the label has no letters or digits, and never starts with a digit', () => {
    expect(toCamelCase('<=')).toBe('node')
    expect(toCamelCase('3D Thing')).toBe('node3dThing')
  })
})

describe('createNameAllocator', () => {
  it('counts per base starting at 1', () => {
    const names = createNameAllocator(new Set())

    expect([names.counted('lerp'), names.counted('add'), names.counted('lerp')]).toEqual([
      'lerp1',
      'add1',
      'lerp2',
    ])
  })

  it('skips reserved names instead of reusing them', () => {
    const names = createNameAllocator(new Set(['vec2', 'vec3']))

    expect([names.counted('vec'), names.counted('vec')]).toEqual(['vec1', 'vec4'])
  })
})
