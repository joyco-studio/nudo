import { describe, expect, it } from 'vitest'
import { isValidIdentifier } from './is-valid-identifier'

describe('isValidIdentifier', () => {
  it('accepts JS identifiers', () => {
    expect(isValidIdentifier('waveSpeed')).toBe(true)
    expect(isValidIdentifier('_a1')).toBe(true)
    expect(isValidIdentifier('$uv')).toBe(true)
  })

  it('rejects names that are not identifiers', () => {
    expect(isValidIdentifier('2x')).toBe(false)
    expect(isValidIdentifier('my var')).toBe(false)
    expect(isValidIdentifier('')).toBe(false)
    expect(isValidIdentifier('a-b')).toBe(false)
  })

  it('rejects reserved words and ambiguous globals', () => {
    expect(isValidIdentifier('class')).toBe(false)
    expect(isValidIdentifier('yield')).toBe(false)
    expect(isValidIdentifier('undefined')).toBe(false)
    expect(isValidIdentifier('NaN')).toBe(false)
    expect(isValidIdentifier('Infinity')).toBe(false)
  })

  it('allows reserved words as a prefix of a longer name', () => {
    expect(isValidIdentifier('classic')).toBe(true)
  })

  it('accepts exactly 64 characters and rejects 65', () => {
    expect(isValidIdentifier('a'.repeat(64))).toBe(true)
    expect(isValidIdentifier('a'.repeat(65))).toBe(false)
  })
})
