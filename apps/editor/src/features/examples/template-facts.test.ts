import { asPropertyId, float, texture, vec2, vec3 } from '@nudo-tsl/core'
import type { BlackboardProperty } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { EXAMPLES } from '@/examples'
import { PAPER_GRAIN } from '@/examples/build/bundled-textures'
import { templateTexture } from '@/examples/template-texture'

import { propertyDisplay, templateFacts, templateGraph } from './template-facts'

function property(overrides: Partial<BlackboardProperty>): BlackboardProperty {
  return {
    id: asPropertyId('p1'),
    label: 'Value',
    name: 'value',
    exposed: true,
    type: 'float',
    value: float(0),
    ...overrides,
  }
}

describe('templateFacts', () => {
  it('counts the nodes that do the work: no master, no comment frames', () => {
    const blob = EXAMPLES.find((example) => example.id === 'iridescent-blob')
    if (blob === undefined) throw new Error('No blob')

    // 26 on the canvas: 20 nodes, 5 comment frames and the master.
    expect(templateFacts(blob)?.nodeCount).toBe(20)
  })

  it('lists every template’s properties', () => {
    for (const example of EXAMPLES) {
      const facts = templateFacts(example)
      expect(facts, example.id).not.toBeNull()
      expect(facts?.properties.length, example.id).toBeGreaterThan(0)
    }
  })

  it('parses a template once and hands the same graph back', () => {
    const [first] = EXAMPLES
    if (first === undefined) throw new Error('No examples')
    expect(templateGraph(first)).not.toBeNull()
    expect(templateGraph(first)).toBe(templateGraph(first))
  })

  it('has no facts for a document that does not parse', () => {
    const [first] = EXAMPLES
    if (first === undefined) throw new Error('No examples')
    expect(templateFacts({ ...first, graph: { schemaVersion: 99 } })).toBeNull()
  })
})

describe('propertyDisplay', () => {
  it('shows a color as its uppercase sRGB hex', () => {
    const white = property({ type: 'vec3', widget: 'color', value: vec3(1, 1, 1) })
    expect(propertyDisplay(white)).toEqual({ kind: 'color', chip: 'color', hex: '#FFFFFF' })
  })

  it('shows numbers as short text', () => {
    expect(propertyDisplay(property({ value: float(0.123456) }))).toEqual({
      kind: 'number',
      chip: 'float',
      text: '0.123',
    })
    expect(propertyDisplay(property({ type: 'vec2', value: vec2(1, 2.5) }))).toEqual({
      kind: 'number',
      chip: 'vec2',
      text: '1, 2.5',
    })
  })

  it('shows an empty texture by kind alone', () => {
    expect(propertyDisplay(property({ type: 'texture', value: texture(null) }))).toEqual({
      kind: 'texture',
      chip: 'texture',
      label: null,
    })
  })

  it('names a texture the template bundles by its label', () => {
    const grain = property({ type: 'texture', value: templateTexture(PAPER_GRAIN) })

    expect(propertyDisplay(grain, [PAPER_GRAIN])).toEqual({
      kind: 'texture',
      chip: 'texture',
      label: 'templateTexture.paper-grain',
    })
    expect(propertyDisplay(grain)).toEqual({ kind: 'texture', chip: 'texture', label: null })
  })
})
