import { describe, expect, it } from 'vitest'
import { addNode } from '../graph/add-node'
import { connect } from '../graph/connect'
import { createGraph } from '../graph/create-graph'
import { setInputValue } from '../graph/set-input-value'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, asEdgeId, asNodeId } from '../types/ids'
import type { Result } from '../types/result'
import { concrete, float, generic, texture, vec2, vec3, vec4 } from '../values/port-value-factories'
import { migrate } from './migrate'
import type { Migration } from './migrate'
import { parseGraph } from './parse-graph'
import { serializeGraph } from './serialize-graph'

const floatSource = defineNode({
  type: 'test/float-source',
  category: 'input',
  label: 'Float source',
  description: 'Concrete float output',
  keywords: [],
  inputs: [{ id: 'value', label: 'Value', type: concrete('float'), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ inputs }) => ({ out: inputs.value }),
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

const textureSource = defineNode({
  type: 'test/texture',
  category: 'texture',
  label: 'Texture',
  description: 'Texture input',
  keywords: [],
  inputs: [{ id: 'map', label: 'Map', type: concrete('texture'), default: texture() }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ tsl, inputs }) => ({ out: tsl.construct('vec3', [inputs.map]) }),
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

const everyValueType = defineNode({
  type: 'test/every-value-type',
  category: 'utility',
  label: 'Every value type',
  description: 'One input per inline value type',
  keywords: [],
  inputs: [
    { id: 'a', label: 'A', type: concrete('float'), default: float(0) },
    { id: 'b', label: 'B', type: concrete('vec2'), default: vec2(0, 0) },
    { id: 'c', label: 'C', type: concrete('vec3'), default: vec3(0, 0, 0) },
    { id: 'd', label: 'D', type: concrete('vec4'), default: vec4(0, 0, 0, 0) },
    { id: 'e', label: 'E', type: concrete('texture'), default: texture() },
    { id: 'f', label: 'F', type: concrete('texture'), default: texture() },
  ],
  outputs: [],
  build: () => ({}),
})

const registry = createNodeRegistry()
;[floatSource, pass, textureSource, everyValueType, master].forEach((definition) =>
  registry.register(definition),
)

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const unwrapError = <T, E>(result: Result<T, E>): E => {
  if (result.ok) throw new Error('Expected a failure')
  return result.error
}

const build = (nodeIds: readonly string[]): Graph =>
  nodeIds.reduce(
    (graph, id, index) =>
      unwrap(
        addNode(graph, registry, {
          id: asNodeId(id),
          type: id.startsWith('t') ? 'test/texture' : 'test/float-source',
          position: { x: index * 10, y: -(index + 1) },
        }),
      ),
    createGraph(),
  )

const richGraph = (): Graph => {
  let graph = build(['f1', 't1'])
  graph = unwrap(setInputValue(graph, { nodeId: asNodeId('f1'), portId: 'value' }, float(0.25)))
  graph = unwrap(
    setInputValue(graph, { nodeId: asNodeId('t1'), portId: 'map' }, texture('asset-1')),
  )
  graph = unwrap(
    setInputValue(graph, { nodeId: MASTER_NODE_ID, portId: 'baseColor' }, vec3(0.1, 0.2, 0.3)),
  )
  return unwrap(
    connect(graph, registry, {
      id: asEdgeId('e1'),
      from: { nodeId: asNodeId('t1'), portId: 'out' },
      to: { nodeId: MASTER_NODE_ID, portId: 'baseColor' },
    }),
  )
}

const documentOf = (graph: Graph): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(serializeGraph(graph))
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Expected a JSON object')
  return Object.fromEntries(Object.entries(parsed))
}

const withNode = (
  document: Record<string, unknown>,
  id: string,
  node: unknown,
): Record<string, unknown> => {
  return {
    ...document,
    nodes: { ...Object.fromEntries(Object.entries(document.nodes ?? {})), [id]: node },
  }
}

const without = (document: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(document).filter(([entryKey]) => entryKey !== key))

const nodeJson = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'x',
  type: 'test/float-source',
  position: { x: 1, y: 2 },
  inputValues: {},
  params: {},
  ...overrides,
})

describe('serializeGraph and parseGraph', () => {
  it('round-trips createGraph through serialize/parse', () => {
    const graph = createGraph()

    expect(unwrap(parseGraph(serializeGraph(graph), registry))).toEqual(graph)
  })

  it('round-trips a graph with edges, values and textures', () => {
    const graph = richGraph()

    expect(unwrap(parseGraph(serializeGraph(graph), registry))).toEqual(graph)
    expect(unwrap(parseGraph(JSON.parse(serializeGraph(graph)), registry))).toEqual(graph)
  })

  it('serialize is stable regardless of insertion order', () => {
    const forward = richGraph()
    const reversed: Graph = {
      ...forward,
      nodes: Object.fromEntries(Object.entries(forward.nodes).reverse()),
      edges: Object.fromEntries(Object.entries(forward.edges).reverse()),
    }

    expect(serializeGraph(reversed)).toBe(serializeGraph(forward))
    const nodeIds = Object.keys(documentOf(forward).nodes ?? {})
    expect(nodeIds).toEqual([...nodeIds].sort())
  })

  it('serializes with 2-space indentation and a fixed key order', () => {
    const text = serializeGraph(createGraph())

    expect(text).toBe(
      [
        '{',
        '  "schemaVersion": 1,',
        '  "nodes": {',
        '    "master": {',
        '      "id": "master",',
        '      "type": "master/stack",',
        '      "position": {',
        '        "x": 600,',
        '        "y": 0',
        '      },',
        '      "inputValues": {},',
        '      "params": {}',
        '    }',
        '  },',
        '  "edges": {},',
        '  "properties": []',
        '}',
      ].join('\n'),
    )
  })

  it('rejects text that is not JSON', () => {
    expect(unwrapError(parseGraph('not json {', registry))).toEqual({ code: 'invalid-json' })
  })

  it('rejects non-object documents', () => {
    expect(unwrapError(parseGraph('[]', registry))).toEqual({ code: 'invalid-shape', path: '$' })
    expect(unwrapError(parseGraph(null, registry))).toEqual({ code: 'invalid-shape', path: '$' })
  })

  it('rejects bad JSON shape with path', () => {
    const document = withNode(
      documentOf(createGraph()),
      'x',
      nodeJson({ position: { x: '1', y: 2 } }),
    )

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.position.x',
    })
  })

  it('rejects a node whose id differs from its key', () => {
    const document = withNode(documentOf(createGraph()), 'x', nodeJson({ id: 'y' }))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.id',
    })
  })

  it('rejects NaN/Infinity in values', () => {
    const base = createGraph()
    const notANumber = withNode(
      documentOf(base),
      'x',
      nodeJson({ inputValues: { value: { type: 'float', value: Number.NaN } } }),
    )
    const infinite = withNode(
      documentOf(base),
      'x',
      nodeJson({ inputValues: { value: { type: 'vec2', value: [0, Number.POSITIVE_INFINITY] } } }),
    )
    const infinitePosition = withNode(
      documentOf(base),
      'x',
      nodeJson({ position: { x: Infinity, y: 0 } }),
    )
    const nonFiniteParam = withNode(
      documentOf(base),
      'x',
      nodeJson({ params: { amount: Number.NaN } }),
    )

    expect(unwrapError(parseGraph(notANumber, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.inputValues.value.value',
    })
    expect(unwrapError(parseGraph(infinite, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.inputValues.value.value',
    })
    expect(unwrapError(parseGraph(infinitePosition, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.position.x',
    })
    expect(unwrapError(parseGraph(nonFiniteParam, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.params.amount',
    })
  })

  it('rejects tuple lengths that do not match the port value type', () => {
    const shortVec3 = withNode(
      documentOf(createGraph()),
      'x',
      nodeJson({ inputValues: { value: { type: 'vec3', value: [1, 2] } } }),
    )
    const unknownType = withNode(
      documentOf(createGraph()),
      'x',
      nodeJson({ inputValues: { value: { type: 'mat4', value: [] } } }),
    )

    expect(unwrapError(parseGraph(shortVec3, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.inputValues.value.value',
    })
    expect(unwrapError(parseGraph(unknownType, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.inputValues.value.type',
    })
  })

  it('accepts every port value type', () => {
    const base = createGraph()
    const document = withNode(
      documentOf(base),
      'x',
      nodeJson({
        type: 'test/every-value-type',
        inputValues: {
          a: float(1),
          b: vec2(1, 2),
          c: vec3(1, 2, 3),
          d: vec4(1, 2, 3, 4),
          e: texture(null),
          f: texture('asset'),
        },
        params: { kind: 'simplex', octaves: 4, wrap: true },
      }),
    )

    const graph = unwrap(parseGraph(document, registry))

    expect(graph.nodes[asNodeId('x')]?.params).toEqual({ kind: 'simplex', octaves: 4, wrap: true })
  })

  it('rejects future schemaVersion', () => {
    const document = { ...documentOf(createGraph()), schemaVersion: 2 }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'unsupported-version',
      version: 2,
    })
  })

  it('rejects a missing or malformed schemaVersion', () => {
    const withoutVersion = without(documentOf(createGraph()), 'schemaVersion')

    expect(unwrapError(parseGraph(withoutVersion, registry))).toEqual({
      code: 'invalid-shape',
      path: 'schemaVersion',
    })
    expect(unwrapError(parseGraph({ ...withoutVersion, schemaVersion: '1' }, registry))).toEqual({
      code: 'invalid-shape',
      path: 'schemaVersion',
    })
  })

  it('rejects an older version without a registered migration', () => {
    const document = { ...documentOf(createGraph()), schemaVersion: 0 }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'unsupported-version',
      version: 0,
    })
  })

  it('rejects unknown node type', () => {
    const document = withNode(documentOf(createGraph()), 'x', nodeJson({ type: 'test/missing' }))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'unknown-node-type',
      type: 'test/missing',
    })
  })

  it('rejects graph without master', () => {
    const noNodes = { ...documentOf(createGraph()), nodes: {} }
    const masterOfWrongType = {
      ...documentOf(createGraph()),
      nodes: { master: nodeJson({ id: 'master' }) },
    }
    const secondMaster = withNode(
      documentOf(createGraph()),
      'x',
      nodeJson({ type: 'master/stack' }),
    )

    expect(unwrapError(parseGraph(noNodes, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.master',
    })
    expect(unwrapError(parseGraph(masterOfWrongType, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.master.type',
    })
    expect(unwrapError(parseGraph(secondMaster, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.type',
    })
  })

  it('rejects non-empty properties', () => {
    const document = { ...documentOf(createGraph()), properties: [{}] }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'properties',
    })
  })

  it('applies chained migrations v0→v1', () => {
    const addProperties: Migration = {
      from: 0,
      migrate: (input) => ({ ...input, properties: [] }),
    }
    const current = without(documentOf(createGraph()), 'properties')
    const legacy = { ...current, schemaVersion: 0 }

    const graph = unwrap(parseGraph(legacy, registry, [addProperties]))

    expect(graph).toEqual(createGraph())
  })

  it('migrate stamps each step with the next version and returns a failure instead of throwing', () => {
    const noOp: Migration = { from: 0, migrate: (input) => ({ ...input }) }
    const broken: Migration = {
      from: 0,
      migrate: () => {
        throw new Error('bad migration')
      },
    }

    expect(unwrap(migrate({ schemaVersion: 0 }, [noOp]))).toEqual({ schemaVersion: 1 })
    expect(unwrapError(migrate({ schemaVersion: 0 }, [broken]))).toEqual({
      code: 'invalid-shape',
      path: 'schemaVersion',
    })
  })

  it('rejects edges whose endpoints reference missing nodes', () => {
    const document = {
      ...documentOf(createGraph()),
      edges: {
        e1: {
          id: 'e1',
          from: { nodeId: 'ghost', portId: 'out' },
          to: { nodeId: 'master', portId: 'baseColor' },
        },
      },
    }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'edges.e1',
    })
  })

  it('rejects malformed edges with a path', () => {
    const document = {
      ...documentOf(createGraph()),
      edges: {
        e1: { id: 'e1', from: { nodeId: 'master' }, to: { nodeId: 'master', portId: 'a' } },
      },
    }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'edges.e1.from.portId',
    })
  })

  describe('edges against node definitions', () => {
    const withPass = (id: string): Record<string, unknown> =>
      withNode(documentOf(createGraph()), id, nodeJson({ id, type: 'test/pass' }))
    const edgeJson = (
      id: string,
      from: readonly [string, string],
      to: readonly [string, string],
    ) => ({
      id,
      from: { nodeId: from[0], portId: from[1] },
      to: { nodeId: to[0], portId: to[1] },
    })
    const rejectedAt = (document: Record<string, unknown>, path: string) => {
      expect(unwrapError(parseGraph(document, registry))).toEqual({ code: 'invalid-shape', path })
    }

    it('rejects an edge that leaves a port its source does not define', () => {
      const document = {
        ...withPass('a'),
        edges: { e1: edgeJson('e1', ['a', 'nope'], ['master', 'baseColor']) },
      }

      rejectedAt(document, 'edges.e1')
    })

    it('rejects an edge that leaves an input port instead of an output', () => {
      const document = {
        ...withPass('a'),
        edges: { e1: edgeJson('e1', ['a', 'a'], ['master', 'baseColor']) },
      }

      rejectedAt(document, 'edges.e1')
    })

    it('rejects an edge that enters a port its target does not define', () => {
      const document = {
        ...withPass('a'),
        edges: { e1: edgeJson('e1', ['a', 'out'], ['master', 'nope']) },
      }

      rejectedAt(document, 'edges.e1')
    })

    it('rejects an edge that enters an output port', () => {
      const document = {
        ...withNode(withPass('a'), 'b', nodeJson({ id: 'b', type: 'test/pass' })),
        edges: { e1: edgeJson('e1', ['a', 'out'], ['b', 'out']) },
      }

      rejectedAt(document, 'edges.e1')
    })

    it('rejects a second edge into the same input', () => {
      const document = {
        ...withNode(withPass('a'), 'b', nodeJson({ id: 'b', type: 'test/pass' })),
        edges: {
          e1: edgeJson('e1', ['a', 'out'], ['master', 'baseColor']),
          e2: edgeJson('e2', ['b', 'out'], ['master', 'baseColor']),
        },
      }

      rejectedAt(document, 'edges.e2')
    })

    it('accepts one output feeding several inputs', () => {
      const document = {
        ...withNode(withPass('a'), 'b', nodeJson({ id: 'b', type: 'test/pass' })),
        edges: {
          e1: edgeJson('e1', ['a', 'out'], ['master', 'baseColor']),
          e2: edgeJson('e2', ['a', 'out'], ['b', 'a']),
        },
      }

      expect(parseGraph(document, registry).ok).toBe(true)
    })
  })

  it('rejects inline values for inputs the node does not define', () => {
    const document = withNode(
      documentOf(createGraph()),
      'x',
      nodeJson({ inputValues: { value: float(1), ghost: float(2) } }),
    )

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.inputValues.ghost',
    })
  })

  it('rejects cyclic graphs', () => {
    const base = withNode(
      withNode(documentOf(createGraph()), 'a', nodeJson({ id: 'a', type: 'test/pass' })),
      'b',
      nodeJson({ id: 'b', type: 'test/pass' }),
    )
    const edge = (id: string, from: string, to: string) => ({
      id,
      from: { nodeId: from, portId: 'out' },
      to: { nodeId: to, portId: 'a' },
    })
    const cyclic = { ...base, edges: { e1: edge('e1', 'a', 'b'), e2: edge('e2', 'b', 'a') } }
    const selfLoop = { ...base, edges: { e1: edge('e1', 'a', 'a') } }

    expect(unwrapError(parseGraph(cyclic, registry))).toEqual({
      code: 'invalid-shape',
      path: 'edges',
    })
    expect(unwrapError(parseGraph(selfLoop, registry))).toEqual({
      code: 'invalid-shape',
      path: 'edges',
    })
  })
})
