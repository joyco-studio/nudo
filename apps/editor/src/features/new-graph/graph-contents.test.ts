import { addNode, addProperty, asNodeId, asPropertyId, createGraph, float } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { es } from '@/i18n/messages/es'
import { createTranslator, translateEnglish } from '@/i18n/translate'
import { registry } from '@/store/registry'

import { describeGraphContents, graphContents } from './graph-contents'

function unwrap(result: { ok: true; value: Graph } | { ok: false; error: unknown }): Graph {
  if (!result.ok) throw new Error('Graph operation failed')
  return result.value
}

const withSine = (graph: Graph, id: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(id), type: 'math/sin', position: { x: 0, y: 0 } }))

const withProperty = (graph: Graph): Graph =>
  unwrap(
    addProperty(graph, {
      id: asPropertyId('p'),
      label: 'Speed',
      name: 'speed',
      exposed: true,
      type: 'float',
      value: float(1),
    }),
  )

describe('graphContents', () => {
  it('counts the nodes besides the master, and the properties', () => {
    expect(graphContents(createGraph())).toEqual({ nodeCount: 0, propertyCount: 0 })
    expect(graphContents(withProperty(withSine(withSine(createGraph(), 'a'), 'b')))).toEqual({
      nodeCount: 2,
      propertyCount: 1,
    })
  })
})

describe('describeGraphContents', () => {
  it('names what a reset clears, in plain words', () => {
    const t = translateEnglish
    expect(describeGraphContents({ nodeCount: 1, propertyCount: 0 }, t)).toBe('1 node')
    expect(describeGraphContents({ nodeCount: 2, propertyCount: 1 }, t)).toBe(
      '2 nodes and 1 property',
    )
    expect(describeGraphContents({ nodeCount: 0, propertyCount: 3 }, t)).toBe('3 properties')
  })

  it('names it in Spanish, singular and plural', () => {
    const t = createTranslator(es)
    expect(describeGraphContents({ nodeCount: 1, propertyCount: 1 }, t)).toBe(
      '1 nodo y 1 propiedad',
    )
    expect(describeGraphContents({ nodeCount: 2, propertyCount: 0 }, t)).toBe('2 nodos')
  })
})
