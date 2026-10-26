import { describe, expect, it } from 'vitest'
import { componentCount, widestType } from './widest-type'

describe('widestType', () => {
  it('returns the widest vector type', () => {
    expect(widestType(['float', 'vec3', 'vec2'])).toBe('vec3')
    expect(widestType(['vec4', 'float'])).toBe('vec4')
    expect(widestType(['float'])).toBe('float')
  })

  it('returns null for an empty list', () => {
    expect(widestType([])).toBeNull()
  })
})

describe('componentCount', () => {
  it('counts the components of each vector type', () => {
    expect(componentCount('float')).toBe(1)
    expect(componentCount('vec2')).toBe(2)
    expect(componentCount('vec3')).toBe(3)
    expect(componentCount('vec4')).toBe(4)
  })
})
