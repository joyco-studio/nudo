import { describe, expect, it } from 'vitest'

import { es } from '@/i18n/messages/es'
import { createTranslator, translateEnglish as t } from '@/i18n/translate'

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
    expect(describePortSource({ nodeTitle: 'Noise', portLabel: 'Out' }, t)).toBe('from Noise · Out')
    expect(
      describePortSource({ nodeTitle: 'Ruido', portLabel: 'Salida' }, createTranslator(es)),
    ).toBe('viene de Ruido · Salida')
  })

  it('describes a port by its meaning, then its source', () => {
    const port = { label: 'A', dataType: 'float' as const, description: 'The value to scale.' }

    expect(portAccessibleDescription({ ...port, source: null }, t)).toBe('The value to scale.')
    expect(
      portAccessibleDescription({ ...port, source: { nodeTitle: 'Time', portLabel: 'Out' } }, t),
    ).toBe('The value to scale. From Time, Out.')
    expect(portAccessibleDescription({ ...port, description: null, source: null }, t)).toBeNull()
  })

  it('adds the formula to what a node announces, when it has one', () => {
    expect(nodeAccessibleDescription(definitionOf('math/multiply'), t)).toBe(
      'Multiplies two values, component by component: use it to scale, tint or mask. ' +
        'Formula: A × B.',
    )
    expect(nodeAccessibleDescription(definitionOf('input/time'), t)).toBe(
      definitionOf('input/time').description,
    )
  })
})
