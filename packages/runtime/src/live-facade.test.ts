import { Node } from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { createLiveFacade } from './live-facade'

const BUILTIN_NAMES = [
  'time',
  'uv',
  'normalWorld',
  'normalView',
  'positionLocal',
  'positionWorld',
  'positionViewDirection',
] as const

describe('createLiveFacade', () => {
  const tsl = createLiveFacade()

  it.each(BUILTIN_NAMES)('resolves the %s builtin to a node', (name) => {
    expect(tsl.builtin(name)).toBeInstanceOf(Node)
  })

  it('builds expression nodes from every operation', () => {
    const a = tsl.construct('float', [0.25])
    const b = tsl.construct('float', [2])
    const expressions = [
      tsl.add(a, b),
      tsl.mul(a, b),
      tsl.sin(a),
      tsl.pow(a, b),
      tsl.oneMinus(a),
      tsl.clamp(a, tsl.construct('float', [0]), tsl.construct('float', [1])),
      tsl.dot(tsl.builtin('normalView'), tsl.builtin('positionViewDirection')),
      tsl.mix(a, b, tsl.construct('float', [0.5])),
    ]

    for (const expression of expressions) expect(expression).toBeInstanceOf(Node)
  })

  it('constructs vectors from numbers and nodes', () => {
    const xy = tsl.construct('vec2', [1, 2])
    const xyz = tsl.construct('vec3', [xy, 3])
    const xyzw = tsl.construct('vec4', [xyz, 1])

    expect(xyzw).toBeInstanceOf(Node)
  })

  it('swizzles components off a vector node', () => {
    const vector = tsl.construct('vec4', [1, 2, 3, 4])

    expect(tsl.swizzle(vector, 'x')).toBeInstanceOf(Node)
    expect(tsl.swizzle(vector, 'xy')).toBeInstanceOf(Node)
    expect(tsl.swizzle(vector, 'xyz')).toBeInstanceOf(Node)
  })
})
