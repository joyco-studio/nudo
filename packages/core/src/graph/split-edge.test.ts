import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import { resolvePortTypes } from '../type-inference/resolve-port-types'
import { portKey } from '../type-inference/port-key'
import type { Graph } from '../types/graph'
import type { Result } from '../types/result'
import { MASTER_NODE_ID, asEdgeId, asNodeId } from '../types/ids'
import { concrete, float, generic, vec3 } from '../values/port-value-factories'
import { addNode } from './add-node'
import { connect } from './connect'
import { createGraph } from './create-graph'
import { splitEdge } from './split-edge'
import type { SplitEdgeInput } from './split-edge'

const vec3Source = defineNode({
  type: 'test/vec3-source',
  category: 'input',
  label: 'Vec3 source',
  description: 'Concrete vec3 output',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ tsl }) => ({ out: tsl.construct('vec3', [0, 0, 0]) }),
})

const reroute = defineNode({
  type: 'test/reroute',
  category: 'utility',
  label: 'Reroute',
  description: 'Passes its input through',
  keywords: [],
  inputs: [{ id: 'in', label: 'In', type: generic('T'), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: generic('T') }],
  passthrough: true,
  build: ({ inputs }) => ({ out: inputs.in }),
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

const registry = createNodeRegistry()
;[vec3Source, reroute, master].forEach((definition) => registry.register(definition))

const unwrap = <T>(result: Result<T, unknown>): T => {
  if (!result.ok) throw new Error(`expected ok result, got ${JSON.stringify(result.error)}`)
  return result.value
}

const SOURCE = asNodeId('src')
const REROUTE = asNodeId('dot')
const EDGE = asEdgeId('src-to-master')

const connectedGraph = (): Graph => {
  const withSource = unwrap(
    addNode(createGraph(), registry, {
      id: SOURCE,
      type: 'test/vec3-source',
      position: { x: 0, y: 0 },
    }),
  )
  return unwrap(
    connect(withSource, registry, {
      id: EDGE,
      from: { nodeId: SOURCE, portId: 'out' },
      to: { nodeId: MASTER_NODE_ID, portId: 'baseColor' },
    }),
  )
}

const splitInput = (overrides: Partial<SplitEdgeInput> = {}): SplitEdgeInput => ({
  edgeId: EDGE,
  node: { id: REROUTE, type: 'test/reroute', position: { x: 100, y: 40 } },
  inputPortId: 'in',
  outputPortId: 'out',
  edgeIds: [asEdgeId('into-dot'), asEdgeId('out-of-dot')],
  ...overrides,
})

describe('splitEdge', () => {
  it('places the node on the edge: source to its input, its output to the old target', () => {
    const graph = unwrap(splitEdge(connectedGraph(), registry, splitInput()))

    expect(graph.nodes[REROUTE]?.position).toEqual({ x: 100, y: 40 })
    expect(graph.edges[EDGE]).toBeUndefined()
    expect(Object.values(graph.edges)).toEqual([
      {
        id: asEdgeId('into-dot'),
        from: { nodeId: SOURCE, portId: 'out' },
        to: { nodeId: REROUTE, portId: 'in' },
      },
      {
        id: asEdgeId('out-of-dot'),
        from: { nodeId: REROUTE, portId: 'out' },
        to: { nodeId: MASTER_NODE_ID, portId: 'baseColor' },
      },
    ])
  })

  it('lets a generic node take the type of the value it carries', () => {
    const graph = unwrap(splitEdge(connectedGraph(), registry, splitInput()))
    const types = resolvePortTypes(graph, registry)

    expect(types.outputs.get(portKey({ nodeId: REROUTE, portId: 'out' }))).toBe('vec3')
  })

  it('rejects an edge that is not in the graph and leaves the graph alone', () => {
    const graph = connectedGraph()
    const result = splitEdge(graph, registry, splitInput({ edgeId: asEdgeId('missing') }))

    expect(result).toEqual({ ok: false, error: { code: 'edge-not-found', edgeId: 'missing' } })
  })

  it('rejects a node whose ports cannot carry the value', () => {
    const result = splitEdge(connectedGraph(), registry, splitInput({ inputPortId: 'nope' }))

    expect(result.ok).toBe(false)
  })

  it('does not mutate the graph it was given', () => {
    const graph = connectedGraph()
    const snapshot = JSON.stringify(graph)
    unwrap(splitEdge(graph, registry, splitInput()))

    expect(JSON.stringify(graph)).toBe(snapshot)
  })
})
