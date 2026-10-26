import { describe, expect, it } from 'vitest'
import { convertValue } from './convert-value'
import { float, splat, vec2, vec3, vec4, texture } from './port-value-factories'

describe('convertValue', () => {
  it('pads with 0 and w with 1', () => {
    expect(convertValue(vec2(1, 2), 'vec4')).toEqual(vec4(1, 2, 0, 1))
    expect(convertValue(vec2(1, 2), 'vec3')).toEqual(vec3(1, 2, 0))
    expect(convertValue(vec3(1, 2, 3), 'vec4')).toEqual(vec4(1, 2, 3, 1))
  })

  it('splats float into every component', () => {
    expect(convertValue(float(3), 'vec3')).toEqual(vec3(3, 3, 3))
    expect(convertValue(float(3), 'vec4')).toEqual(vec4(3, 3, 3, 3))
  })

  it('truncates vectors', () => {
    expect(convertValue(vec3(1, 2, 3), 'float')).toEqual(float(1))
    expect(convertValue(vec4(1, 2, 3, 4), 'vec2')).toEqual(vec2(1, 2))
  })

  it('returns the same value when the type matches', () => {
    expect(convertValue(vec3(1, 2, 3), 'vec3')).toEqual(vec3(1, 2, 3))
  })

  it('returns texture values unchanged', () => {
    const value = texture('asset-1')
    expect(convertValue(value, 'vec3')).toBe(value)
  })
})

describe('splat', () => {
  it('fills every component', () => {
    expect(splat('vec4', 0)).toEqual(vec4(0, 0, 0, 0))
    expect(splat('float', 2)).toEqual(float(2))
  })
})
