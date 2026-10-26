import { describe, expect, it } from 'vitest'
import { addNode } from '../graph/add-node'
import { connect } from '../graph/connect'
import { createGraph } from '../graph/create-graph'
import { setInputValue } from '../graph/set-input-value'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import { serializeGraph } from '../serialization/serialize-graph'
import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, asEdgeId, asNodeId } from '../types/ids'
import type { EdgeId, NodeId } from '../types/ids'
import type { Result } from '../types/result'
import { concrete, float, generic, vec3 } from '../values/port-value-factories'
import { extractFragment } from './extract-fragment'
import { parseFragment } from './parse-fragment'
import { pasteFragment } from './paste-fragment'
import { serializeFragment } from './serialize-fragment'

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
;[floatSource, pass, master].forEach((definition) => registry.register(definition))

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const unwrapError = <T, E>(result: Result<T, E>): E => {
  if (result.ok) throw new Error('Expected a failure')
  return result.error
}

const nodeIdOf = (raw: string): NodeId => asNodeId(raw)

/** source -> middle -> master.baseColor, plus an `outsider` feeding middle's sibling. */
const sampleGraph = (): Graph => {
  let graph = createGraph()
  const nodes: readonly (readonly [string, string, number])[] = [
    ['source', 'test/float-source', 0],
    ['middle', 'test/pass', 100],
    ['outsider', 'test/float-source', 200],
  ]
  for (const [id, type, x] of nodes) {
    graph = unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: { x, y: 5 } }))
  }
  graph = unwrap(setInputValue(graph, { nodeId: asNodeId('middle'), portId: 'a' }, float(0.75)))
  const edges: readonly (readonly [string, string, string, string, string])[] = [
    ['e-inner', 'source', 'out', 'middle', 'a'],
    ['e-to-master', 'middle', 'out', 'master', 'baseColor'],
  ]
  for (const [id, fromNode, fromPort, toNode, toPort] of edges) {
    graph = unwrap(
      connect(graph, registry, {
        id: asEdgeId(id),
        from: { nodeId: asNodeId(fromNode), portId: fromPort },
        to: { nodeId: asNodeId(toNode), portId: toPort },
      }),
    )
  }
  return graph
}

const createIdFactory = <T extends string>(prefix: string, brand: (raw: string) => T) => {
  let counter = 0
  return () => {
    counter += 1
    return brand(`${prefix}-${String(counter)}`)
  }
}

const fragmentJson = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    kind: 'nudo-tsl/fragment',
    schemaVersion: 1,
    nodes: [
      { id: 'a', type: 'test/float-source', position: { x: 0, y: 0 }, inputValues: {}, params: {} },
      { id: 'b', type: 'test/pass', position: { x: 10, y: 0 }, inputValues: {}, params: {} },
    ],
    edges: [{ id: 'e1', from: { nodeId: 'a', portId: 'out' }, to: { nodeId: 'b', portId: 'a' } }],
    ...overrides,
  })

const node = (id: string, type = 'test/pass') => ({
  id,
  type,
  position: { x: 0, y: 0 },
  inputValues: {},
  params: {},
})

const edge = (id: string, from: string, to: string) => ({
  id,
  from: { nodeId: from, portId: 'out' },
  to: { nodeId: to, portId: 'a' },
})

describe('extractFragment', () => {
  it('extractFragment drops master and external edges', () => {
    const graph = sampleGraph()

    const fragment = extractFragment(graph, [
      nodeIdOf('source'),
      nodeIdOf('middle'),
      MASTER_NODE_ID,
    ])

    expect(fragment?.kind).toBe('nudo-tsl/fragment')
    expect(fragment?.schemaVersion).toBe(1)
    expect(fragment?.nodes.map((candidate) => candidate.id)).toEqual(['middle', 'source'])
    expect(fragment?.edges.map((candidate) => candidate.id)).toEqual(['e-inner'])
  })

  it('drops edges that leave the set even when only one endpoint is selected', () => {
    const fragment = extractFragment(sampleGraph(), [nodeIdOf('source')])

    expect(fragment?.nodes).toHaveLength(1)
    expect(fragment?.edges).toEqual([])
  })

  it('returns null when nothing but master (or unknown ids) is selected', () => {
    expect(extractFragment(sampleGraph(), [MASTER_NODE_ID])).toBeNull()
    expect(extractFragment(sampleGraph(), [nodeIdOf('ghost')])).toBeNull()
    expect(extractFragment(sampleGraph(), [])).toBeNull()
  })

  it('serializes and parses back to the same fragment', () => {
    const fragment = extractFragment(sampleGraph(), [nodeIdOf('source'), nodeIdOf('middle')])
    if (fragment === null) throw new Error('Expected a fragment')

    expect(unwrap(parseFragment(serializeFragment(fragment), registry))).toEqual(fragment)
  })

  it('serializeFragment is stable regardless of selection order', () => {
    const forward = extractFragment(sampleGraph(), [nodeIdOf('source'), nodeIdOf('middle')])
    const reversed = extractFragment(sampleGraph(), [nodeIdOf('middle'), nodeIdOf('source')])
    if (forward === null || reversed === null) throw new Error('Expected fragments')

    expect(serializeFragment(reversed)).toBe(serializeFragment(forward))
  })
})

describe('pasteFragment', () => {
  it('pasteFragment remaps ids and offsets positions', () => {
    const graph = sampleGraph()
    const fragment = extractFragment(graph, [nodeIdOf('source'), nodeIdOf('middle')])
    if (fragment === null) throw new Error('Expected a fragment')

    const pasted = pasteFragment(graph, fragment, {
      offset: { x: 30, y: -4 },
      createNodeId: createIdFactory('new-node', asNodeId),
      createEdgeId: createIdFactory('new-edge', asEdgeId),
    })

    expect(pasted.pastedNodeIds).toEqual(['new-node-1', 'new-node-2'])
    const [first, second] = pasted.pastedNodeIds
    if (first === undefined || second === undefined) throw new Error('Expected two pasted ids')
    // Fragment nodes are sorted by id: middle, source.
    expect(pasted.graph.nodes[first]).toEqual({
      id: 'new-node-1',
      type: 'test/pass',
      position: { x: 130, y: 1 },
      inputValues: { a: float(0.75) },
      params: {},
    })
    expect(pasted.graph.nodes[second]?.position).toEqual({ x: 30, y: 1 })
    expect(Object.values(pasted.graph.edges).filter((e) => e.id.startsWith('new-edge'))).toEqual([
      {
        id: 'new-edge-1',
        from: { nodeId: 'new-node-2', portId: 'out' },
        to: { nodeId: 'new-node-1', portId: 'a' },
      },
    ])
  })

  it('keeps the original graph and nodes untouched', () => {
    const graph = sampleGraph()
    const before = serializeGraph(graph)
    const fragment = extractFragment(graph, [nodeIdOf('source'), nodeIdOf('middle')])
    if (fragment === null) throw new Error('Expected a fragment')

    const pasted = pasteFragment(graph, fragment, {
      offset: { x: 1, y: 1 },
      createNodeId: createIdFactory('n', asNodeId),
      createEdgeId: createIdFactory('e', asEdgeId),
    })

    expect(serializeGraph(graph)).toBe(before)
    expect(Object.keys(pasted.graph.nodes)).toHaveLength(Object.keys(graph.nodes).length + 2)
    expect(pasted.graph.nodes[MASTER_NODE_ID]).toEqual(graph.nodes[MASTER_NODE_ID])
    expect(pasted.graph.edges).toMatchObject(graph.edges)
  })

  it('pasting the same fragment twice yields independent copies', () => {
    const graph = sampleGraph()
    const fragment = extractFragment(graph, [nodeIdOf('source'), nodeIdOf('middle')])
    if (fragment === null) throw new Error('Expected a fragment')
    const options = {
      offset: { x: 0, y: 0 },
      createNodeId: createIdFactory<NodeId>('n', asNodeId),
      createEdgeId: createIdFactory<EdgeId>('e', asEdgeId),
    }

    const once = pasteFragment(graph, fragment, options)
    const twice = pasteFragment(once.graph, fragment, options)

    expect(Object.keys(twice.graph.nodes)).toHaveLength(Object.keys(graph.nodes).length + 4)
    expect(Object.keys(twice.graph.edges)).toHaveLength(Object.keys(graph.edges).length + 2)
  })
})

describe('parseFragment', () => {
  it('parseFragment rejects prose, plain graph JSON and unknown types', () => {
    expect(unwrapError(parseFragment('just some copied prose', registry))).toEqual({
      code: 'invalid-json',
    })
    expect(unwrapError(parseFragment(serializeGraph(createGraph()), registry))).toEqual({
      code: 'invalid-shape',
      path: 'kind',
    })
    expect(
      unwrapError(
        parseFragment(fragmentJson({ nodes: [node('a', 'test/missing')], edges: [] }), registry),
      ),
    ).toEqual({ code: 'unknown-node-type', type: 'test/missing' })
  })

  it('rejects JSON that is not an object', () => {
    expect(unwrapError(parseFragment('42', registry))).toEqual({
      code: 'invalid-shape',
      path: '$',
    })
  })

  it('accepts a valid fragment', () => {
    const fragment = unwrap(parseFragment(fragmentJson(), registry))

    expect(fragment.nodes.map((candidate) => candidate.id)).toEqual(['a', 'b'])
    expect(fragment.edges.map((candidate) => candidate.id)).toEqual(['e1'])
  })

  it('rejects a future fragment version', () => {
    expect(unwrapError(parseFragment(fragmentJson({ schemaVersion: 2 }), registry))).toEqual({
      code: 'unsupported-version',
      version: 2,
    })
  })

  it('rejects malformed node and edge lists with a path', () => {
    expect(unwrapError(parseFragment(fragmentJson({ nodes: {} }), registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes',
    })
    expect(
      unwrapError(
        parseFragment(
          fragmentJson({ nodes: [{ ...node('a'), position: { x: 'no', y: 0 } }], edges: [] }),
          registry,
        ),
      ),
    ).toEqual({ code: 'invalid-shape', path: 'nodes.0.position.x' })
  })

  it('rejects edges that reference nodes outside the fragment', () => {
    const text = fragmentJson({ nodes: [node('a')], edges: [edge('e1', 'a', 'outside')] })

    expect(unwrapError(parseFragment(text, registry))).toEqual({
      code: 'invalid-shape',
      path: 'edges.0',
    })
  })

  it('rejects a fragment that contains the master node', () => {
    const byId = fragmentJson({ nodes: [node('master', 'test/pass')], edges: [] })
    const byType = fragmentJson({ nodes: [node('copy', 'master/stack')], edges: [] })

    expect(unwrapError(parseFragment(byId, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.0',
    })
    expect(unwrapError(parseFragment(byType, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.0',
    })
  })

  it('rejects duplicate node ids and cyclic fragments', () => {
    const duplicates = fragmentJson({ nodes: [node('a'), node('a')], edges: [] })
    const cyclic = fragmentJson({
      nodes: [node('a'), node('b')],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
    })

    expect(unwrapError(parseFragment(duplicates, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.1.id',
    })
    expect(unwrapError(parseFragment(cyclic, registry))).toEqual({
      code: 'invalid-shape',
      path: 'edges',
    })
  })
})
