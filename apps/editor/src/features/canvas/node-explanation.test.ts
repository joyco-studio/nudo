import { describe, expect, it } from 'vitest'

import { registry } from '../../store/registry'
import {
  describePortSource,
  nodeAccessibleDescription,
  portAccessibleDescription,
} from './node-explanation'

function definitionOf(type: string) {
  const definition = registry.get(type)
  if (definition === undefined) throw new Error(`Missing ${type}`)
  return definition
}

describe('node explanation', () => {
  it('names the source of a connected input', () => {
    expect(describePortSource({ nodeTitle: 'Noise', portLabel: 'Out' })).toBe('from Noise · Out')
  })

  it('describes a port by its meaning, then its source', () => {
    const port = { label: 'A', dataType: 'float' as const, description: 'The value to scale.' }

    expect(portAccessibleDescription({ ...port, source: null })).toBe('The value to scale.')
    expect(
      portAccessibleDescription({ ...port, source: { nodeTitle: 'Time', portLabel: 'Out' } }),
    ).toBe('The value to scale. From Time, Out.')
    expect(portAccessibleDescription({ ...port, description: null, source: null })).toBeNull()
  })

  it('adds the formula to what a node announces, when it has one', () => {
    expect(nodeAccessibleDescription(definitionOf('math/multiply'))).toBe(
      'Multiplies two values, component by component: use it to scale, tint or mask. ' +
        'Formula: A × B.',
    )
    expect(nodeAccessibleDescription(definitionOf('input/time'))).toBe(
      definitionOf('input/time').description,
    )
  })
})
