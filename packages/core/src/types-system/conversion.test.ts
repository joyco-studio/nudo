import { describe, expect, it } from 'vitest'
import { getConversion } from './conversion'
import { DATA_TYPES } from '../types/data-type'

describe('getConversion', () => {
  it('splats float into vectors', () => {
    expect(getConversion('float', 'vec3')).toEqual({
      ok: true,
      conversion: { kind: 'splat', from: 'float', to: 'vec3' },
    })
  })

  it('truncates and pads', () => {
    expect(getConversion('vec4', 'vec2')).toMatchObject({
      ok: true,
      conversion: { kind: 'truncate' },
    })
    expect(getConversion('vec2', 'vec4')).toMatchObject({ ok: true, conversion: { kind: 'pad' } })
  })

  it('truncates vecN to float', () => {
    expect(getConversion('vec3', 'float')).toMatchObject({
      ok: true,
      conversion: { kind: 'truncate' },
    })
  })

  it('needs no conversion for the same type', () => {
    for (const type of DATA_TYPES) {
      expect(getConversion(type, type)).toEqual({ ok: true, conversion: null })
    }
  })

  it('connects texture only to texture', () => {
    expect(getConversion('texture', 'vec3')).toEqual({ ok: false })
    expect(getConversion('float', 'texture')).toEqual({ ok: false })
    expect(getConversion('texture', 'texture')).toEqual({ ok: true, conversion: null })
  })
})
