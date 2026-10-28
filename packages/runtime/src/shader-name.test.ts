import { describe, expect, it } from 'vitest'

import { toShaderName } from './shader-name'

const SHADER_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/

describe('toShaderName', () => {
  it('prefixes plain names and leaves them readable', () => {
    expect(toShaderName('glow')).toBe('nudo_glow')
    expect(toShaderName('wave_speed')).toBe('nudo_wave_speed')
    expect(toShaderName('vec3')).toBe('nudo_vec3')
  })

  it('escapes `$`, which WGSL and GLSL do not allow, and the escape letter itself', () => {
    expect(toShaderName('my$glow')).toBe('nudo_myQdglow')
    expect(toShaderName('Quality')).toBe('nudo_QQuality')
    expect(toShaderName('my$glow')).toMatch(SHADER_IDENTIFIER)
  })

  it.each([
    ['a$b', 'a_b'],
    ['a$b', 'aQdb'],
    ['a$$b', 'aQd$b'],
    ['$', '_'],
    ['Q$', 'QQd'],
    ['a$_b', 'a_$b'],
  ])('gives %s and %s different names', (first, second) => {
    expect(toShaderName(first)).not.toBe(toShaderName(second))
  })

  it('never maps two of a set of tricky names to the same name', () => {
    const alphabet = ['a', '_', '$', 'Q', 'd']
    const names = alphabet.flatMap((first) =>
      alphabet.flatMap((second) => alphabet.map((third) => `${first}${second}${third}`)),
    )
    const shaderNames = new Set(names.map(toShaderName))

    expect(shaderNames.size).toBe(names.length)
    for (const name of shaderNames) expect(name).not.toContain('$')
  })
})
