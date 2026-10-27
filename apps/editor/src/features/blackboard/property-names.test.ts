import { describe, expect, it } from 'vitest'

import { defaultPropertyName, followsLabel, suggestReferenceName } from './property-names'

const NONE: ReadonlySet<string> = new Set()

describe('defaultPropertyName', () => {
  it('numbers the base from 1, skipping taken names', () => {
    expect(defaultPropertyName('float', NONE)).toBe('float1')
    expect(defaultPropertyName('float', new Set(['float1', 'float2']))).toBe('float3')
    expect(defaultPropertyName('color', new Set(['float1']))).toBe('color1')
  })

  it('separates a base that ends in a digit, so the count stays readable', () => {
    expect(defaultPropertyName('vec2', NONE)).toBe('vec2_1')
    expect(defaultPropertyName('vec2', new Set(['vec2_1']))).toBe('vec2_2')
  })
})

describe('suggestReferenceName', () => {
  it('keeps a label that already is an identifier', () => {
    expect(suggestReferenceName('waveSpeed', NONE, 'float')).toBe('waveSpeed')
  })

  it('camel-cases words', () => {
    expect(suggestReferenceName('Wave Speed', NONE, 'float')).toBe('waveSpeed')
    expect(suggestReferenceName('UV scale', NONE, 'float')).toBe('uvScale')
    expect(suggestReferenceName('  sun-band  tint! ', NONE, 'color')).toBe('sunBandTint')
  })

  it('makes names that would be invalid identifiers usable', () => {
    expect(suggestReferenceName('2x', NONE, 'float')).toBe('_2x')
    expect(suggestReferenceName('class', NONE, 'float')).toBe('_class')
    expect(suggestReferenceName('!!!', NONE, 'texture')).toBe('texture')
    expect(suggestReferenceName('a'.repeat(80), NONE, 'float')).toHaveLength(64)
  })

  it('avoids names other properties use', () => {
    expect(suggestReferenceName('speed', new Set(['speed']), 'float')).toBe('speed2')
    expect(suggestReferenceName('speed', new Set(['speed', 'speed2']), 'float')).toBe('speed3')
  })
})

describe('followsLabel', () => {
  it('is true while the reference is the one the label suggests', () => {
    expect(followsLabel({ label: 'float1', name: 'float1' }, NONE, 'float')).toBe(true)
    expect(followsLabel({ label: 'Wave Speed', name: 'waveSpeed' }, NONE, 'float')).toBe(true)
  })

  it('is false once the reference was chosen by hand', () => {
    expect(followsLabel({ label: 'Wave Speed', name: 'uWave' }, NONE, 'float')).toBe(false)
  })
})
