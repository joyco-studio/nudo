import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph, GraphEdge, GraphNode, PortRef } from '../types/graph'
import { asEdgeId, asNodeId } from '../types/ids'
import { concrete, float, generic, vec3 } from '../values/port-value-factories'
import { checkConnection } from './check-connection'
import { wouldCreateCycle } from './would-create-cycle'

const floatSource = defineNode({
  type: 'test/float-source',
  category: 'input',
  label: 'Float source',
  description: 'Concrete float output',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const textureSource = defineNode({
  type: 'test/texture-source',
  category: 'texture',
  label: 'Texture source',
  description: 'Concrete texture output',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('texture') }],
  build: ({ tsl }) => ({ out: tsl.builtin('uv') }),
})

const pass = defineNode({
  type: 'test/pass',
  category: 'utility',
  label: 'Pass',
  description: 'Generic pass-through',
  keywords: [],
  inputs: [{ id: 'a', label: 'A', type: generic('T'), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic('T') }],
  build: ({ inputs }) => ({ out: inputs.a }),
})

const vec2Only = defineNode({
  type: 'test/vec2-only',
  category: 'utility',
  label: 'Vec2 only',
  description: 'Generic input restricted to vec2 and vec3',
  keywords: [],
  inputs: [{ id: 'a', label: 'A', type: generic('T', ['vec2', 'vec3']), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const master = defineNode({
  type: 'master/stack',
  category: 'master',
  label: 'Master',
  description: 'Master output',
  keywords: [],
  inputs: [
    { id: 'baseColor', label: 'Base color', type: concrete('vec3'), default: vec3(1, 1, 1) },
  ],
  outputs: [],
  build: () => ({}),
})

const createRegistry = () => {
  const registry = createNodeRegistry()
  ;[floatSource, textureSource, pass, vec2Only, master].forEach((definition) =>
    registry.register(definition),
  )
  return registry
}

const node = (id: string, type: string): GraphNode => ({
  id: asNodeId(id),
  type,
  position: { x: 0, y: 0 },
  inputValues: {},
  params: {},
})

const edge = (id: string, from: PortRef, to: PortRef): GraphEdge => ({
  id: asEdgeId(id),
  from,
  to,
})

const ref = (nodeId: string, portId: string): PortRef => ({ nodeId: asNodeId(nodeId), portId })

const graphOf = (nodes: readonly GraphNode[], edges: readonly GraphEdge[] = []): Graph => ({
  schemaVersion: 1,
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  edges: Object.fromEntries(edges.map((e) => [e.id, e])),
  properties: [],
})

describe('checkConnection', () => {
  const registry = createRegistry()

  it('rejects connecting a node to itself', () => {
    const graph = graphOf([node('a', 'test/pass')])

    expect(checkConnection(graph, registry, ref('a', 'out'), ref('a', 'a'))).toEqual({
      ok: false,
      reason: 'same-node',
    })
  })

  it('rejects a cycle a→b→a', () => {
    const graph = graphOf(
      [node('a', 'test/pass'), node('b', 'test/pass')],
      [edge('e1', ref('a', 'out'), ref('b', 'a'))],
    )

    expect(checkConnection(graph, registry, ref('b', 'out'), ref('a', 'a'))).toEqual({
      ok: false,
      reason: 'cycle',
    })
  })

  it('rejects a longer cycle a→b→c→a', () => {
    const graph = graphOf(
      [node('a', 'test/pass'), node('b', 'test/pass'), node('c', 'test/pass')],
      [edge('e1', ref('a', 'out'), ref('b', 'a')), edge('e2', ref('b', 'out'), ref('c', 'a'))],
    )

    expect(checkConnection(graph, registry, ref('c', 'out'), ref('a', 'a'))).toEqual({
      ok: false,
      reason: 'cycle',
    })
  })

  it('still rejects a cycle through an input other than the one being replaced', () => {
    const graph = graphOf(
      [node('a', 'test/pass'), node('b', 'test/pass')],
      [edge('e1', ref('b', 'out'), ref('a', 'a'))],
    )

    expect(checkConnection(graph, registry, ref('a', 'out'), ref('b', 'a'))).toEqual({
      ok: false,
      reason: 'cycle',
    })
  })

  it('allows a connection that only looks cyclic through the edge it replaces', () => {
    const graph = graphOf(
      [node('a', 'test/pass'), node('b', 'test/pass'), node('src', 'test/float-source')],
      [edge('e1', ref('a', 'out'), ref('b', 'a'))],
    )

    // b.a currently comes from a. Replacing it with src leaves no path from b back to a.
    expect(checkConnection(graph, registry, ref('src', 'out'), ref('b', 'a'))).toEqual({
      ok: true,
      conversion: null,
    })
  })

  it('rejects texture into vec3', () => {
    const graph = graphOf([node('tex', 'test/texture-source'), node('master', 'master/stack')])

    expect(checkConnection(graph, registry, ref('tex', 'out'), ref('master', 'baseColor'))).toEqual(
      {
        ok: false,
        reason: 'type-mismatch',
      },
    )
  })

  it('float into concrete vec3 input reports splat conversion', () => {
    const graph = graphOf([node('src', 'test/float-source'), node('master', 'master/stack')])

    expect(checkConnection(graph, registry, ref('src', 'out'), ref('master', 'baseColor'))).toEqual(
      {
        ok: true,
        conversion: { kind: 'splat', from: 'float', to: 'vec3' },
      },
    )
  })

  it('accepts a source type inside the allowed list of a generic input with no conversion', () => {
    const graph = graphOf([node('src', 'test/float-source'), node('p', 'test/pass')])

    expect(checkConnection(graph, registry, ref('src', 'out'), ref('p', 'a'))).toEqual({
      ok: true,
      conversion: null,
    })
  })

  it('rejects a source type outside the allowed list of a generic input', () => {
    const graph = graphOf([node('src', 'test/float-source'), node('v', 'test/vec2-only')])

    expect(checkConnection(graph, registry, ref('src', 'out'), ref('v', 'a'))).toEqual({
      ok: false,
      reason: 'type-mismatch',
    })
  })

  it('never lets a texture feed a generic input', () => {
    const graph = graphOf([node('tex', 'test/texture-source'), node('p', 'test/pass')])

    expect(checkConnection(graph, registry, ref('tex', 'out'), ref('p', 'a'))).toEqual({
      ok: false,
      reason: 'type-mismatch',
    })
  })

  it('rejects output-to-output', () => {
    const graph = graphOf([node('src', 'test/float-source'), node('p', 'test/pass')])

    expect(checkConnection(graph, registry, ref('src', 'out'), ref('p', 'out'))).toEqual({
      ok: false,
      reason: 'unknown-port',
    })
  })

  it('rejects input-to-input and unknown nodes', () => {
    const graph = graphOf([node('p', 'test/pass'), node('master', 'master/stack')])

    expect(checkConnection(graph, registry, ref('p', 'a'), ref('master', 'baseColor'))).toEqual({
      ok: false,
      reason: 'unknown-port',
    })
    expect(
      checkConnection(graph, registry, ref('ghost', 'out'), ref('master', 'baseColor')),
    ).toEqual({
      ok: false,
      reason: 'unknown-port',
    })
  })
})

describe('wouldCreateCycle', () => {
  it('detects a path from the target back to the source', () => {
    const graph = graphOf(
      [node('a', 'test/pass'), node('b', 'test/pass')],
      [edge('e1', ref('a', 'out'), ref('b', 'a'))],
    )

    expect(wouldCreateCycle(graph, ref('b', 'out'), ref('a', 'a'))).toBe(true)
    expect(wouldCreateCycle(graph, ref('a', 'out'), ref('b', 'a'))).toBe(false)
  })

  it('treats a self connection as a cycle', () => {
    const graph = graphOf([node('a', 'test/pass')])

    expect(wouldCreateCycle(graph, ref('a', 'out'), ref('a', 'a'))).toBe(true)
  })
})
