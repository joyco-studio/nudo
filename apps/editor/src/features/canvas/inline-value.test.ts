import { asNodeId, float, vec2, vec3 } from '@nudo-tsl/core'
import type { GraphNode, InputDefinition, VectorPortValue } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { inlineValue, valueComponents, withComponent } from './inline-value'

const INPUT: InputDefinition<string> = {
  id: 'a',
  label: 'A',
  type: { kind: 'generic', group: 'T', allowed: ['float', 'vec2', 'vec3', 'vec4'] },
  default: float(0.5),
}

function nodeWith(inputValues: GraphNode['inputValues'] = {}): GraphNode {
  return { id: asNodeId('n'), type: 'math/add', position: { x: 0, y: 0 }, inputValues, params: {} }
}

describe('inlineValue', () => {
  it('falls back to the input default', () => {
    expect(inlineValue(nodeWith(), INPUT, 'float')).toEqual(float(0.5))
  })

  it('converts the stored value to the resolved type so the field shows the right arity', () => {
    expect(inlineValue(nodeWith({ a: float(2) }), INPUT, 'vec3')).toEqual(vec3(2, 2, 2))
    expect(inlineValue(nodeWith({ a: vec3(1, 2, 3) }), INPUT, 'vec2')).toEqual(vec2(1, 2))
  })

  it('has no inline value for textures', () => {
    expect(inlineValue(nodeWith(), INPUT, 'texture')).toBeNull()
  })
})

describe('valueComponents and withComponent', () => {
  it('reads and replaces single components', () => {
    const scalar: VectorPortValue = { type: 'float', value: 4 }
    const vector: VectorPortValue = { type: 'vec3', value: [1, 2, 3] }

    expect(valueComponents(scalar)).toEqual([4])
    expect(valueComponents(vector)).toEqual([1, 2, 3])
    expect(withComponent(vector, 1, 9)).toEqual(vec3(1, 9, 3))
    expect(withComponent(scalar, 0, 7)).toEqual(float(7))
  })
})
