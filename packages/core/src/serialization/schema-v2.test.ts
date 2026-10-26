import { describe, expect, it } from 'vitest'
import { addNode } from '../graph/add-node'
import { addProperty } from '../graph/add-property'
import { createGraph } from '../graph/create-graph'
import { setParam } from '../graph/set-param'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { NodeRegistry } from '../registry/node-registry'
import type { BlackboardProperty } from '../types/blackboard-property'
import type { Graph } from '../types/graph'
import { asNodeId, asPropertyId } from '../types/ids'
import type { AnyNodeDefinition } from '../types/node-definition'
import type { Result } from '../types/result'
import { concrete, float, vec3 } from '../values/port-value-factories'
import waterGraphV1 from './fixtures/water-graph-v1.json'
import { DEFAULT_MIGRATIONS } from './migrations'
import { parseGraph } from './parse-graph'
import { CURRENT_SCHEMA_VERSION } from './schema-version'
import { serializeGraph } from './serialize-graph'

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const unwrapError = <T, E>(result: Result<T, E>): E => {
  if (result.ok) throw new Error('Expected a failure')
  return result.error
}

/** A definition with the given ports, enough for structural validation of the phase-1 fixture. */
const stub = (type: string, inputIds: readonly string[], outputIds: readonly string[]) => {
  const definition: AnyNodeDefinition = {
    type,
    category: 'utility',
    label: type,
    description: type,
    keywords: [],
    inputs: inputIds.map((id) => ({
      id,
      label: id,
      type: concrete('float'),
      default: float(0),
    })),
    outputs: outputIds.map((id) => ({ id, label: id, type: concrete('float') })),
    build: () => ({}),
  }
  return definition
}

const waterRegistry = (): NodeRegistry => {
  const registry = createNodeRegistry()
  const definitions = [
    stub('master/stack', ['baseColor', 'emission', 'metalness', 'opacity', 'roughness'], []),
    stub('input/color', ['color'], ['out']),
    stub('input/float', ['x'], ['out']),
    stub('input/time', [], ['out']),
    stub('input/uv', [], ['out']),
    stub('effects/fresnel', ['power'], ['out']),
    stub('math/add', ['a', 'b'], ['out']),
    stub('math/multiply', ['a', 'b'], ['out']),
    stub('math/sin', ['in'], ['out']),
    stub('interpolation/lerp', ['a', 'b', 't'], ['out']),
  ]
  definitions.forEach((definition) => registry.register(definition))
  return registry
}

const propertyFloat = defineNode({
  type: 'property/float',
  category: 'input',
  label: 'Float property',
  description: 'Reads a float property',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [{ id: 'propertyId', label: 'Property', kind: 'string', default: '', hidden: true }],
  reads: 'property',
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const noise = defineNode({
  type: 'test/noise',
  category: 'texture',
  label: 'Noise',
  description: 'Noise with params',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [
    {
      id: 'kind',
      label: 'Kind',
      kind: 'enum',
      options: [
        { value: 'simplex', label: 'Simplex' },
        { value: 'perlin', label: 'Perlin' },
      ],
      default: 'simplex',
    },
    { id: 'octaves', label: 'Octaves', kind: 'number', default: 4 },
  ],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
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
;[master, noise, propertyFloat].forEach((definition) => registry.register(definition))

const speed: BlackboardProperty = {
  id: asPropertyId('p-speed'),
  label: 'Wave speed',
  name: 'waveSpeed',
  exposed: true,
  type: 'float',
  value: float(1.5),
}

const tint: BlackboardProperty = {
  id: asPropertyId('p-tint'),
  label: 'Tint',
  name: 'tint',
  exposed: false,
  type: 'vec3',
  widget: 'color',
  value: vec3(0.1, 0.2, 0.3),
}

const richGraph = (): Graph => {
  let graph = unwrap(addProperty(unwrap(addProperty(createGraph(), speed)), tint))
  graph = unwrap(
    addNode(graph, registry, {
      id: asNodeId('reader'),
      type: 'property/float',
      position: { x: 1, y: 2 },
    }),
  )
  const reader = graph.nodes[asNodeId('reader')]
  if (reader === undefined) throw new Error('missing reader')
  graph = {
    ...graph,
    nodes: { ...graph.nodes, [reader.id]: { ...reader, params: { propertyId: speed.id } } },
  }
  graph = unwrap(
    addNode(graph, registry, { id: asNodeId('n'), type: 'test/noise', position: { x: 0, y: 0 } }),
  )
  return unwrap(setParam(graph, registry, { nodeId: asNodeId('n'), paramId: 'collapsed' }, true))
}

const documentOf = (graph: Graph): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(serializeGraph(graph))
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Expected a JSON object')
  return Object.fromEntries(Object.entries(parsed))
}

const nodeEntry = (id: string, type: string, params: Record<string, unknown>) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  inputValues: {},
  params,
})

const withNode = (
  document: Record<string, unknown>,
  node: ReturnType<typeof nodeEntry>,
): Record<string, unknown> => ({
  ...document,
  nodes: { ...Object.fromEntries(Object.entries(document.nodes ?? {})), [node.id]: node },
})

const propertyJson = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'p-speed',
  label: 'Wave speed',
  name: 'waveSpeed',
  exposed: true,
  type: 'float',
  value: { type: 'float', value: 1.5 },
  ...overrides,
})

describe('schema version 2', () => {
  it('declares version 2 as current', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2)
    expect(createGraph().schemaVersion).toBe(2)
  })

  it('migrates the phase-1 water document (v1) to v2 with identical nodes and edges', () => {
    const legacy: unknown = JSON.parse(JSON.stringify(waterGraphV1))
    expect(waterGraphV1.schemaVersion).toBe(1)

    const graph = unwrap(parseGraph(legacy, waterRegistry()))

    expect(graph.schemaVersion).toBe(2)
    expect(graph.properties).toEqual([])
    expect(graph.nodes).toEqual(waterGraphV1.nodes)
    expect(graph.edges).toEqual(waterGraphV1.edges)
    expect(Object.keys(graph.nodes)).toHaveLength(16)
    expect(Object.keys(graph.edges)).toHaveLength(15)
  })

  it('migrates the v1 document given as text, and re-serializes it as v2', () => {
    const graph = unwrap(parseGraph(JSON.stringify(waterGraphV1), waterRegistry()))

    expect(JSON.parse(serializeGraph(graph))).toMatchObject({ schemaVersion: 2, properties: [] })
  })

  it('exposes a single v1 to v2 default migration', () => {
    expect(DEFAULT_MIGRATIONS.map((step) => step.from)).toEqual([1])
  })

  it('rejects a version newer than current', () => {
    const document = { ...documentOf(createGraph()), schemaVersion: 3 }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'unsupported-version',
      version: 3,
    })
  })
})

describe('properties serialization', () => {
  it('round-trips properties, widget included', () => {
    const graph = richGraph()

    expect(unwrap(parseGraph(serializeGraph(graph), registry))).toEqual(graph)
    expect(unwrap(parseGraph(serializeGraph(graph), registry)).properties).toEqual([speed, tint])
  })

  it('writes property keys in a fixed order and omits an absent widget', () => {
    const { properties } = documentOf(richGraph())
    if (!Array.isArray(properties)) throw new Error('Expected a property list')
    const keyLists = properties.map((property: unknown) =>
      typeof property === 'object' && property !== null ? Object.keys(property) : [],
    )

    expect(keyLists).toEqual([
      ['id', 'label', 'name', 'exposed', 'type', 'value'],
      ['id', 'label', 'name', 'exposed', 'type', 'widget', 'value'],
    ])
  })

  it('keeps universal params through the round trip', () => {
    const graph = unwrap(parseGraph(serializeGraph(richGraph()), registry))

    expect(graph.nodes[asNodeId('n')]?.params).toEqual({ kind: 'simplex', collapsed: true })
  })
})

describe('parseGraph property validation', () => {
  const doc = (): Record<string, unknown> => documentOf(richGraph())

  it('rejects a property node whose propertyId is missing', () => {
    const document = withNode(doc(), nodeEntry('bad', 'property/float', {}))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.bad.params.propertyId',
    })
  })

  it('rejects a property node whose propertyId is not a string', () => {
    const document = withNode(doc(), nodeEntry('bad', 'property/float', { propertyId: 3 }))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.bad.params.propertyId',
    })
  })

  it('rejects a property node that points at an unknown property', () => {
    const document = withNode(doc(), nodeEntry('bad', 'property/float', { propertyId: 'ghost' }))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.bad.params.propertyId',
    })
  })

  it('rejects an unknown param id', () => {
    const document = withNode(doc(), nodeEntry('x', 'test/noise', { grain: 1 }))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.params.grain',
    })
  })

  it('rejects an enum value outside its options', () => {
    const document = withNode(doc(), nodeEntry('x', 'test/noise', { kind: 'worley' }))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.params.kind',
    })
  })

  it('rejects a param whose value has the wrong kind', () => {
    const document = withNode(doc(), nodeEntry('x', 'test/noise', { octaves: 'four' }))

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.params.octaves',
    })
  })

  it('rejects an invalid universal param value and accepts a valid one', () => {
    const invalid = withNode(doc(), nodeEntry('x', 'test/noise', { previewMode: '4d' }))
    const valid = withNode(doc(), nodeEntry('x', 'test/noise', { previewMode: '2d' }))

    expect(unwrapError(parseGraph(invalid, registry))).toEqual({
      code: 'invalid-shape',
      path: 'nodes.x.params.previewMode',
    })
    expect(parseGraph(valid, registry).ok).toBe(true)
  })

  it('rejects duplicate property names', () => {
    const document = {
      ...doc(),
      properties: [propertyJson(), propertyJson({ id: 'p-other' })],
    }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'properties.1.name',
    })
  })

  it('rejects duplicate property ids', () => {
    const document = {
      ...doc(),
      properties: [propertyJson(), propertyJson({ name: 'other' })],
    }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'properties.1.id',
    })
  })

  it('rejects an invalid property name', () => {
    const document = { ...doc(), properties: [propertyJson({ name: 'my var' })] }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'properties.0.name',
    })
  })

  it('rejects a property whose value does not match its type', () => {
    const document = {
      ...doc(),
      properties: [propertyJson({ value: { type: 'vec3', value: [0, 0, 0] } })],
    }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: 'properties.0.value.type',
    })
  })

  it.each([
    ['label', { label: 3 }],
    ['exposed', { exposed: 'yes' }],
    ['type', { type: 'mat4' }],
    ['widget', { widget: 'slider' }],
    ['id', { id: 7 }],
  ])('rejects a malformed property %s', (field, overrides) => {
    const document = { ...doc(), properties: [propertyJson(overrides)] }

    expect(unwrapError(parseGraph(document, registry))).toEqual({
      code: 'invalid-shape',
      path: `properties.0.${field}`,
    })
  })

  it('rejects properties that are not a list', () => {
    expect(unwrapError(parseGraph({ ...doc(), properties: {} }, registry))).toEqual({
      code: 'invalid-shape',
      path: 'properties',
    })
  })
})
