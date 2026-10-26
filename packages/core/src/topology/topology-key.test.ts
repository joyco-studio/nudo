import { describe, expect, it } from 'vitest'
import { addNode } from '../graph/add-node'
import { connect } from '../graph/connect'
import { createGraph } from '../graph/create-graph'
import { moveNodes } from '../graph/move-nodes'
import { setInputValue } from '../graph/set-input-value'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, asEdgeId, asNodeId } from '../types/ids'
import type { Result } from '../types/result'
import { concrete, float, vec3 } from '../values/port-value-factories'
import { topologyKey } from './topology-key'

const passThrough = defineNode({
  type: 'test/pass',
  category: 'utility',
  label: 'Pass',
  description: 'Vec3 pass-through',
  keywords: [],
  inputs: [{ id: 'a', label: 'A', type: concrete('vec3'), default: vec3(0, 0, 0) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ inputs }) => ({ out: inputs.a }),
})

const master = defineNode({
  type: 'master/stack',
  category: 'master',
  label: 'Master',
  description: 'Master output',
  keywords: [],
  inputs: [{ id: 'baseColor', label: 'Base', type: concrete('vec3'), default: vec3(1, 1, 1) }],
  outputs: [],
  build: () => ({}),
})

const registry = createNodeRegistry()
registry.register(master)
registry.register(passThrough)

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const origin = { x: 0, y: 0 }

const graphWithPass = (): Graph =>
  unwrap(
    addNode(createGraph(), registry, { id: asNodeId('p'), type: 'test/pass', position: origin }),
  )

const withParams = (graph: Graph, params: Record<string, string | number | boolean>): Graph => {
  const node = graph.nodes[asNodeId('p')]
  if (node === undefined) throw new Error('missing node p')
  return { ...graph, nodes: { ...graph.nodes, [node.id]: { ...node, params } } }
}

describe('topologyKey', () => {
  it('ignores positions and values, changes on edge add', () => {
    const graph = graphWithPass()
    const baseline = topologyKey(graph)

    const moved = moveNodes(graph, { [asNodeId('p')]: { x: 40, y: -10 } })
    const edited = unwrap(
      setInputValue(graph, { nodeId: asNodeId('p'), portId: 'a' }, vec3(0.2, 0.4, 0.6)),
    )
    expect(topologyKey(moved)).toBe(baseline)
    expect(topologyKey(edited)).toBe(baseline)

    const connected = unwrap(
      connect(graph, registry, {
        id: asEdgeId('e1'),
        from: { nodeId: asNodeId('p'), portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'baseColor' },
      }),
    )
    expect(topologyKey(connected)).not.toBe(baseline)
  })

  it('does not depend on node or param insertion order', () => {
    const first = withParams(graphWithPass(), { kind: 'perlin', octaves: 3 })
    const second = withParams(graphWithPass(), { octaves: 3, kind: 'perlin' })
    const reordered: Graph = {
      ...first,
      nodes: Object.fromEntries(Object.entries(first.nodes).reverse()),
    }

    expect(topologyKey(second)).toBe(topologyKey(first))
    expect(topologyKey(reordered)).toBe(topologyKey(first))
  })

  it('changes when a param value changes', () => {
    const base = graphWithPass()

    expect(topologyKey(withParams(base, { kind: 'perlin' }))).not.toBe(
      topologyKey(withParams(base, { kind: 'simplex' })),
    )
  })

  it('ignores universal params but not structural ones', () => {
    const base = withParams(graphWithPass(), { kind: 'perlin' })
    const decorated = withParams(graphWithPass(), {
      kind: 'perlin',
      collapsed: true,
      previewMode: '3d',
    })

    expect(topologyKey(decorated)).toBe(topologyKey(base))
    expect(topologyKey(withParams(graphWithPass(), { kind: 'simplex', collapsed: true }))).not.toBe(
      topologyKey(base),
    )
  })

  it('changes when a node is added', () => {
    expect(topologyKey(graphWithPass())).not.toBe(topologyKey(createGraph()))
  })

  it('ignores float inline values too', () => {
    const graph = graphWithPass()
    const edited = unwrap(setInputValue(graph, { nodeId: asNodeId('p'), portId: 'a' }, float(3)))

    expect(topologyKey(edited)).toBe(topologyKey(graph))
  })
})
