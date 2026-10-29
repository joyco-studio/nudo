import { describe, expect, it, vi } from 'vitest'
import { addNode } from '../graph/add-node'
import { connect } from '../graph/connect'
import { createGraph } from '../graph/create-graph'
import { disconnect } from '../graph/disconnect'
import { setInputValue } from '../graph/set-input-value'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import { addProperty } from '../graph/add-property'
import { addPropertyNode } from '../graph/add-property-node'
import { setParam } from '../graph/set-param'
import type { BlackboardProperty } from '../types/blackboard-property'
import type { Graph, ParamValue, PortRef } from '../types/graph'
import { MASTER_NODE_ID, asEdgeId, asNodeId, asPropertyId } from '../types/ids'
import type { PortValue } from '../types/port-value'
import type { Result } from '../types/result'
import type { TslFacade } from '../types/tsl-facade'
import { concrete, float, generic, texture, vec2, vec3, vec4 } from '../values/port-value-factories'
import { compile } from './compile'
import type { CompileBackend, CompileResult } from './compile-backend'

const formatParts = (parts: readonly (string | number)[]): string => `[${parts.join(',')}]`

const stringFacade: TslFacade<string> = {
  add: (a, b) => `add(${a},${b})`,
  sub: (a, b) => `sub(${a},${b})`,
  mul: (a, b) => `mul(${a},${b})`,
  div: (a, b) => `div(${a},${b})`,
  sin: (a) => `sin(${a})`,
  cos: (a) => `cos(${a})`,
  abs: (a) => `abs(${a})`,
  fract: (a) => `fract(${a})`,
  floor: (a) => `floor(${a})`,
  min: (a, b) => `min(${a},${b})`,
  max: (a, b) => `max(${a},${b})`,
  exp: (a) => `exp(${a})`,
  pow: (a, b) => `pow(${a},${b})`,
  oneMinus: (a) => `oneMinus(${a})`,
  clamp: (x, low, high) => `clamp(${x},${low},${high})`,
  dot: (a, b) => `dot(${a},${b})`,
  length: (a) => `length(${a})`,
  normalize: (a) => `normalize(${a})`,
  distance: (a, b) => `distance(${a},${b})`,
  mix: (a, b, t) => `mix(${a},${b},${t})`,
  step: (edge, x) => `step(${edge},${x})`,
  smoothstep: (edge0, edge1, x) => `smoothstep(${edge0},${edge1},${x})`,
  fwidth: (x) => `fwidth(${x})`,
  remap: (x, inLow, inHigh, outLow, outHigh) =>
    `remap(${x},${inLow},${inHigh},${outLow},${outHigh})`,
  select: (op, a, b, whenTrue, whenFalse) => `select(${op},${a},${b},${whenTrue},${whenFalse})`,
  noise: (kind, p) => `noise(${kind},${p})`,
  voronoi: (p, jitter, metric) => `voronoi(${p},${jitter},${metric})`,
  voronoiCell: (dimensions, p, jitter, metric) =>
    `voronoiCell(${String(dimensions)},${p},${jitter},${metric})`,
  cellNoise: (p) => `cellNoise(${p})`,
  hash: (kind, p, seed) => `hash(${kind},${p},${seed})`,
  checker: (uv) => `checker(${uv})`,
  textureSample: (texture, uv, level) => `textureSample(${texture},${uv},${level ?? 'null'})`,
  colorSpace: (direction, color) => `colorSpace(${direction},${color})`,
  sceneColor: (uv) => `sceneColor(${uv})`,
  sceneDepthFade: (distance) => `sceneDepthFade(${distance})`,
  normalFromHeight: (height, strength) => `normalFromHeight(${height},${strength})`,
  mainLight: (component) => `mainLight(${component})`,
  builtin: (name) => `builtin(${name})`,
  construct: (type, parts) => `construct(${type},${formatParts(parts)})`,
  swizzle: (value, components) => `swizzle(${value},${components})`,
}

const createStringBackend = (options: Pick<CompileBackend<string>, 'nameOutput'> = {}) => {
  const receivedValues = new Map<string, PortValue>()
  const requestedProperties: string[] = []
  const backend: CompileBackend<string> = {
    tsl: stringFacade,
    inputValue: (ref, value) => {
      const key = `${ref.nodeId}:${ref.portId}`
      receivedValues.set(key, value)
      return `u(${key})`
    },
    property: (property) => {
      requestedProperties.push(property.name)
      return `prop(${property.name})`
    },
    ...options,
  }
  return { backend, receivedValues, requestedProperties }
}

const colorSource = defineNode({
  type: 'test/color',
  category: 'input',
  label: 'Color',
  description: 'Vec3 constant',
  keywords: [],
  inputs: [{ id: 'color', label: 'Color', type: concrete('vec3'), default: vec3(1, 1, 1) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ inputs }) => ({ out: inputs.color }),
})

const floatSource = defineNode({
  type: 'test/float',
  category: 'input',
  label: 'Float',
  description: 'Float constant',
  keywords: [],
  inputs: [{ id: 'value', label: 'Value', type: concrete('float'), default: float(0) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ inputs }) => ({ out: inputs.value }),
})

const vec4Source = defineNode({
  type: 'test/vec4',
  category: 'input',
  label: 'Vec4',
  description: 'Vec4 constant',
  keywords: [],
  inputs: [{ id: 'value', label: 'Value', type: concrete('vec4'), default: vec4(0, 0, 0, 1) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec4') }],
  build: ({ inputs }) => ({ out: inputs.value }),
})

const lerp = defineNode({
  type: 'test/lerp',
  category: 'interpolation',
  label: 'Lerp',
  description: 'Mix of two colors',
  keywords: [],
  inputs: [
    { id: 'a', label: 'A', type: concrete('vec3'), default: vec3(0, 0, 0) },
    { id: 'b', label: 'B', type: concrete('vec3'), default: vec3(1, 1, 1) },
    { id: 't', label: 'T', type: concrete('float'), default: float(0.5) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: ({ tsl, inputs }) => ({ out: tsl.mix(inputs.a, inputs.b, inputs.t) }),
})

const add = defineNode({
  type: 'test/add',
  category: 'math',
  label: 'Add',
  description: 'Generic add',
  keywords: [],
  inputs: [
    { id: 'a', label: 'A', type: generic('T'), default: float(0) },
    { id: 'b', label: 'B', type: generic('T'), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic('T') }],
  build: ({ tsl, inputs }) => ({ out: tsl.add(inputs.a, inputs.b) }),
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

const throwing = defineNode({
  type: 'test/throwing',
  category: 'utility',
  label: 'Throwing',
  description: 'Always fails to build',
  keywords: [],
  inputs: [],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
  build: () => {
    throw new Error('boom')
  },
})

const master = defineNode({
  type: 'master/stack',
  category: 'master',
  label: 'Master',
  description: 'Master output',
  keywords: [],
  inputs: [
    {
      id: 'position',
      label: 'Position',
      type: concrete('vec3'),
      default: vec3(0, 0, 0),
      optional: true,
    },
    { id: 'baseColor', label: 'Base color', type: concrete('vec3'), default: vec3(1, 1, 1) },
    { id: 'emission', label: 'Emission', type: concrete('vec3'), default: vec3(0, 0, 0) },
    { id: 'metalness', label: 'Metalness', type: concrete('float'), default: float(0) },
    { id: 'roughness', label: 'Roughness', type: concrete('float'), default: float(0.5) },
    {
      id: 'normal',
      label: 'Normal',
      type: concrete('vec3'),
      default: vec3(0, 0, 1),
      optional: true,
    },
    { id: 'opacity', label: 'Opacity', type: concrete('float'), default: float(1) },
  ],
  outputs: [],
  build: () => ({}),
})

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
  build: ({ property }) => {
    if (property === null) throw new Error('reader built without a property')
    return { out: property }
  },
})

const selector = defineNode({
  type: 'test/selector',
  category: 'utility',
  label: 'Selector',
  description: 'Compares with the configured operator',
  keywords: [],
  inputs: [
    { id: 'a', label: 'A', type: concrete('float'), default: float(0) },
    { id: 'b', label: 'B', type: concrete('float'), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  params: [
    {
      id: 'op',
      label: 'Operator',
      kind: 'enum',
      options: [
        { value: 'lt', label: '<' },
        { value: 'gte', label: '>=' },
      ],
      default: 'lt',
    },
  ],
  build: ({ tsl, inputs, params }) => {
    const op = params.op === 'gte' ? 'gte' : 'lt'
    return { out: tsl.select(op, inputs.a, inputs.b, inputs.a, inputs.b) }
  },
})

const meshUvConsumer = defineNode({
  type: 'test/mesh-uv-consumer',
  category: 'effects',
  label: 'Mesh UV consumer',
  description: 'Reads the mesh UV while its input is unconnected',
  keywords: [],
  inputs: [
    { id: 'uv', label: 'UV', type: concrete('vec2'), default: vec2(0, 0), fallback: 'uv' },
    { id: 'scale', label: 'Scale', type: concrete('float'), default: float(1) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec2') }],
  build: ({ tsl, inputs }) => ({ out: tsl.mul(inputs.uv, inputs.scale) }),
})

const vec2Source = defineNode({
  type: 'test/vec2-source',
  category: 'input',
  label: 'Vec2 source',
  description: 'Vec2 constant',
  keywords: [],
  inputs: [{ id: 'value', label: 'Value', type: concrete('vec2'), default: vec2(0, 0) }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('vec2') }],
  build: ({ inputs }) => ({ out: inputs.value }),
})

const createParamProbe = (onBuild: (params: Readonly<Record<string, ParamValue>>) => void) =>
  defineNode({
    type: 'test/param-probe',
    category: 'utility',
    label: 'Param probe',
    description: 'Reports the params it receives',
    keywords: [],
    inputs: [],
    outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
    params: [
      {
        id: 'kind',
        label: 'Kind',
        kind: 'enum',
        options: [{ value: 'simplex', label: 'Simplex' }],
        default: 'simplex',
      },
      { id: 'wrap', label: 'Wrap', kind: 'boolean', default: true },
      { id: 'name', label: 'Name', kind: 'string', default: 'fallback' },
      { id: 'scale', label: 'Scale', kind: 'number', default: 4 },
    ],
    build: ({ tsl, params }) => {
      onBuild(params)
      return { out: tsl.construct('float', [0]) }
    },
  })

const createRegistry = (
  ...extra: Parameters<ReturnType<typeof createNodeRegistry>['register']>[0][]
) => {
  const registry = createNodeRegistry()
  const definitions = [
    master,
    colorSource,
    floatSource,
    vec4Source,
    lerp,
    add,
    textureSource,
    throwing,
    ...extra,
  ]
  definitions.forEach((definition) => registry.register(definition))
  return registry
}

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const origin = { x: 0, y: 0 }

const withNodes = (
  registry: ReturnType<typeof createRegistry>,
  nodes: readonly (readonly [string, string])[],
): Graph =>
  nodes.reduce(
    (graph, [id, type]) =>
      unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: origin })),
    createGraph(),
  )

const withNodesOn = (
  start: Graph,
  registry: ReturnType<typeof createRegistry>,
  nodes: readonly (readonly [string, string])[],
): Graph =>
  nodes.reduce(
    (graph, [id, type]) =>
      unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: origin })),
    start,
  )

const link = (
  graph: Graph,
  registry: ReturnType<typeof createRegistry>,
  edgeId: string,
  from: readonly [string, string],
  to: readonly [string, string],
): Graph =>
  unwrap(
    connect(graph, registry, {
      id: asEdgeId(edgeId),
      from: { nodeId: asNodeId(from[0]), portId: from[1] },
      to: { nodeId: asNodeId(to[0]), portId: to[1] },
    }),
  )

const compileMaster = (graph: Graph, registry: ReturnType<typeof createRegistry>) => {
  const { backend, receivedValues } = createStringBackend()
  const result = compile(graph, registry, backend, { kind: 'master' })
  return { result, receivedValues }
}

const expectMasterSlots = (result: CompileResult<string>) => {
  if (!result.ok || result.output.kind !== 'master') {
    throw new Error(`Expected a master compilation, got ${JSON.stringify(result)}`)
  }
  return result.output.slots
}

describe('compile', () => {
  it('compiles master baseColor from lerp of two colors', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [
      ['c1', 'test/color'],
      ['c2', 'test/color'],
      ['l', 'test/lerp'],
    ])
    graph = link(graph, registry, 'e1', ['c1', 'out'], ['l', 'a'])
    graph = link(graph, registry, 'e2', ['c2', 'out'], ['l', 'b'])
    graph = link(graph, registry, 'e3', ['l', 'out'], [MASTER_NODE_ID, 'baseColor'])

    const { result } = compileMaster(graph, registry)

    expect(expectMasterSlots(result).baseColor).toBe('mix(u(c1:color),u(c2:color),u(l:t))')
  })

  it('fills unconnected required slots with inline values', () => {
    const registry = createRegistry()
    const { result } = compileMaster(createGraph(), registry)

    expect(expectMasterSlots(result)).toEqual({
      baseColor: 'u(master:baseColor)',
      emission: 'u(master:emission)',
      metalness: 'u(master:metalness)',
      roughness: 'u(master:roughness)',
      opacity: 'u(master:opacity)',
    })
  })

  it('shared node is evaluated once', () => {
    const buildSpy = vi.fn()
    const shared = defineNode({
      type: 'test/shared',
      category: 'utility',
      label: 'Shared',
      description: 'Counts its builds',
      keywords: [],
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
      build: ({ tsl }) => {
        buildSpy()
        return { out: tsl.construct('vec3', [1, 2, 3]) }
      },
    })
    const registry = createRegistry(shared)
    let graph = withNodes(registry, [
      ['s', 'test/shared'],
      ['l', 'test/lerp'],
    ])
    graph = link(graph, registry, 'e1', ['s', 'out'], ['l', 'a'])
    graph = link(graph, registry, 'e2', ['s', 'out'], ['l', 'b'])
    graph = link(graph, registry, 'e3', ['l', 'out'], [MASTER_NODE_ID, 'baseColor'])

    const { result } = compileMaster(graph, registry)

    expect(expectMasterSlots(result).baseColor).toBe(
      'mix(construct(vec3,[1,2,3]),construct(vec3,[1,2,3]),u(l:t))',
    )
    expect(buildSpy).toHaveBeenCalledTimes(1)
  })

  it('float into vec3 slot is splatted', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['f', 'test/float']])
    graph = link(graph, registry, 'e1', ['f', 'out'], [MASTER_NODE_ID, 'baseColor'])

    const { result } = compileMaster(graph, registry)

    expect(expectMasterSlots(result).baseColor).toBe('construct(vec3,[u(f:value)])')
  })

  it('vec4 into vec3 is swizzled xyz', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['v', 'test/vec4']])
    graph = link(graph, registry, 'e1', ['v', 'out'], [MASTER_NODE_ID, 'baseColor'])

    const { result } = compileMaster(graph, registry)

    expect(expectMasterSlots(result).baseColor).toBe('swizzle(u(v:value),xyz)')
  })

  it('vec3 into float slot is swizzled x and vec3 into vec4 input is padded with w = 1', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [
      ['c', 'test/color'],
      ['v', 'test/vec4'],
    ])
    graph = link(graph, registry, 'e1', ['c', 'out'], [MASTER_NODE_ID, 'metalness'])
    graph = link(graph, registry, 'e2', ['c', 'out'], ['v', 'value'])
    graph = link(graph, registry, 'e3', ['v', 'out'], [MASTER_NODE_ID, 'emission'])

    const slots = expectMasterSlots(compileMaster(graph, registry).result)

    expect(slots.metalness).toBe('swizzle(u(c:color),x)')
    expect(slots.emission).toBe('swizzle(construct(vec4,[u(c:color),1]),xyz)')
  })

  it('optional unconnected slots are omitted', () => {
    const registry = createRegistry()
    const slots = expectMasterSlots(compileMaster(createGraph(), registry).result)

    expect('position' in slots).toBe(false)
    expect('normal' in slots).toBe(false)
  })

  it('optional slots are compiled when connected', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['c', 'test/color']])
    graph = link(graph, registry, 'e1', ['c', 'out'], [MASTER_NODE_ID, 'position'])

    const slots = expectMasterSlots(compileMaster(graph, registry).result)

    expect(slots.position).toBe('u(c:color)')
  })

  it('throwing build yields build-failed with nodeId', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['bad', 'test/throwing']])
    graph = link(graph, registry, 'e1', ['bad', 'out'], [MASTER_NODE_ID, 'baseColor'])

    const { result } = compileMaster(graph, registry)

    expect(result).toEqual({
      ok: false,
      errors: [{ nodeId: 'bad', code: 'build-failed', message: 'boom' }],
    })
  })

  it('collects errors from every reachable node', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [
      ['bad1', 'test/throwing'],
      ['bad2', 'test/throwing'],
    ])
    graph = link(graph, registry, 'e1', ['bad1', 'out'], [MASTER_NODE_ID, 'baseColor'])
    graph = link(graph, registry, 'e2', ['bad2', 'out'], [MASTER_NODE_ID, 'emission'])

    const { result } = compileMaster(graph, registry)

    expect(!result.ok && result.errors.map((error) => error.nodeId)).toEqual(['bad1', 'bad2'])
  })

  it('reports each failing node once even when it is shared', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['bad', 'test/throwing']])
    graph = link(graph, registry, 'e1', ['bad', 'out'], [MASTER_NODE_ID, 'baseColor'])
    graph = link(graph, registry, 'e2', ['bad', 'out'], [MASTER_NODE_ID, 'emission'])

    const { result } = compileMaster(graph, registry)

    expect(!result.ok && result.errors).toHaveLength(1)
  })

  it('unreachable broken node does not fail compile', () => {
    const registry = createRegistry()
    const graph = withNodes(registry, [['bad', 'test/throwing']])

    const { result } = compileMaster(graph, registry)

    expect(result.ok).toBe(true)
  })

  it('reachable node without a registered definition yields missing-definition', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['c', 'test/color']])
    graph = link(graph, registry, 'e1', ['c', 'out'], [MASTER_NODE_ID, 'baseColor'])
    const emptyRegistry = createNodeRegistry()
    emptyRegistry.register(master)

    const { result } = compileMaster(graph, emptyRegistry)

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          nodeId: 'c',
          code: 'missing-definition',
          message: 'No definition registered for test/color',
        },
      ],
    })
  })

  it('port target compiles a single expression', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [
      ['c1', 'test/color'],
      ['l', 'test/lerp'],
    ])
    graph = link(graph, registry, 'e1', ['c1', 'out'], ['l', 'a'])
    const ref: PortRef = { nodeId: asNodeId('l'), portId: 'out' }
    const { backend } = createStringBackend()

    const result = compile(graph, registry, backend, { kind: 'port', ref })

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'mix(u(c1:color),u(l:b),u(l:t))' },
    })
  })

  it('port target on an unknown output yields unresolved-type', () => {
    const registry = createRegistry()
    const graph = withNodes(registry, [['c', 'test/color']])
    const { backend } = createStringBackend()

    const result = compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('c'), portId: 'nope' },
    })

    expect(!result.ok && result.errors.map((error) => error.code)).toEqual(['unresolved-type'])
  })

  it('after disconnecting vec3 source, add inline values compile as float', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [
      ['c', 'test/color'],
      ['a', 'test/add'],
    ])
    graph = link(graph, registry, 'e1', ['c', 'out'], ['a', 'a'])
    const target = { kind: 'port', ref: { nodeId: asNodeId('a'), portId: 'out' } } as const

    const connected = createStringBackend()
    expect(compile(graph, registry, connected.backend, target).ok).toBe(true)
    expect(connected.receivedValues.get('a:b')).toEqual(vec3(0, 0, 0))

    const disconnected = createStringBackend()
    graph = disconnect(graph, [asEdgeId('e1')])
    const result = compile(graph, registry, disconnected.backend, target)

    expect(result).toEqual({ ok: true, output: { kind: 'port', expression: 'add(u(a:a),u(a:b))' } })
    expect(disconnected.receivedValues.get('a:a')).toEqual(float(0))
    expect(disconnected.receivedValues.get('a:b')).toEqual(float(0))
  })

  it('converts stored inline values to the resolved input type', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['f', 'test/float']])
    graph = unwrap(
      setInputValue(graph, { nodeId: MASTER_NODE_ID, portId: 'baseColor' }, float(0.25)),
    )

    const { receivedValues } = compileMaster(graph, registry)

    expect(receivedValues.get('master:baseColor')).toEqual(vec3(0.25, 0.25, 0.25))
  })

  it('passes unconnected texture values through unconverted', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [['t', 'test/texture']])
    const storedTexture = texture('asset-1')
    graph = unwrap(setInputValue(graph, { nodeId: asNodeId('t'), portId: 'map' }, storedTexture))
    const { backend, receivedValues } = createStringBackend()

    compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('t'), portId: 'out' },
    })

    expect(receivedValues.get('t:map')).toEqual(storedTexture)
  })

  it('a backend whose inputValue throws yields build-failed on that node', () => {
    const registry = createRegistry()
    const graph = withNodes(registry, [['c', 'test/color']])
    const throwingBackend: CompileBackend<string> = {
      tsl: stringFacade,
      inputValue: (ref) => {
        if (ref.nodeId === 'c') throw new Error('uniform failed')
        return `u(${ref.nodeId}:${ref.portId})`
      },
      property: (property) => `prop(${property.name})`,
    }

    const result = compile(
      unwrap(
        connect(graph, registry, {
          id: asEdgeId('e1'),
          from: { nodeId: asNodeId('c'), portId: 'out' },
          to: { nodeId: MASTER_NODE_ID, portId: 'baseColor' },
        }),
      ),
      registry,
      throwingBackend,
      { kind: 'master' },
    )

    expect(result).toEqual({
      ok: false,
      errors: [{ nodeId: 'c', code: 'build-failed', message: 'uniform failed' }],
    })
  })
  it('select builds with the op taken from the node params', () => {
    const registry = createRegistry(selector)
    let graph = withNodes(registry, [['s', 'test/selector']])
    graph = unwrap(setParam(graph, registry, { nodeId: asNodeId('s'), paramId: 'op' }, 'gte'))
    const { backend } = createStringBackend()

    const result = compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('s'), portId: 'out' },
    })

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'select(gte,u(s:a),u(s:b),u(s:a),u(s:b))' },
    })
  })

  it('unconnected uv falls back to builtin uv without asking the backend for a value', () => {
    const registry = createRegistry(meshUvConsumer)
    const graph = withNodes(registry, [['m', 'test/mesh-uv-consumer']])
    const { backend, receivedValues } = createStringBackend()

    const result = compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('m'), portId: 'out' },
    })

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'mul(builtin(uv),u(m:scale))' },
    })
    expect([...receivedValues.keys()]).toEqual(['m:scale'])
  })

  it('a connected input with a fallback uses the connection instead', () => {
    const registry = createRegistry(meshUvConsumer, vec2Source)
    let graph = withNodes(registry, [
      ['m', 'test/mesh-uv-consumer'],
      ['v', 'test/vec2-source'],
    ])
    graph = link(graph, registry, 'e1', ['v', 'out'], ['m', 'uv'])
    const { backend } = createStringBackend()

    const result = compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('m'), portId: 'out' },
    })

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'mul(u(v:value),u(m:scale))' },
    })
  })

  it('params reach build with defaults filled', () => {
    const receivedParams: Readonly<Record<string, ParamValue>>[] = []
    const registry = createRegistry(createParamProbe((params) => receivedParams.push(params)))
    let graph = withNodes(registry, [['p', 'test/param-probe']])
    graph = unwrap(setParam(graph, registry, { nodeId: asNodeId('p'), paramId: 'scale' }, 9))
    const { backend } = createStringBackend()

    compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('p'), portId: 'out' },
    })

    expect(receivedParams).toEqual([{ kind: 'simplex', wrap: true, name: 'fallback', scale: 9 }])
  })
})

describe('compile properties', () => {
  const speed: BlackboardProperty = {
    id: asPropertyId('p-speed'),
    label: 'Speed',
    name: 'speed',
    exposed: true,
    type: 'float',
    value: float(1),
  }
  const reader = (graph: Graph, registry: ReturnType<typeof createRegistry>, id: string): Graph =>
    unwrap(
      addPropertyNode(graph, registry, {
        id: asNodeId(id),
        propertyId: speed.id,
        position: origin,
      }),
    )

  it('property nodes compile to backend.property once per property even when used twice', () => {
    const registry = createRegistry(propertyFloat)
    let graph = unwrap(addProperty(createGraph(), speed))
    graph = reader(graph, registry, 'r1')
    graph = reader(graph, registry, 'r2')
    graph = withNodesOn(graph, registry, [['a', 'test/add']])
    graph = link(graph, registry, 'e1', ['r1', 'out'], ['a', 'a'])
    graph = link(graph, registry, 'e2', ['r2', 'out'], ['a', 'b'])
    const { backend, requestedProperties } = createStringBackend()

    const result = compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('a'), portId: 'out' },
    })

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'add(prop(speed),prop(speed))' },
    })
    expect(requestedProperties).toEqual(['speed'])
  })

  it('missing property yields missing-property on that node', () => {
    const registry = createRegistry(propertyFloat)
    const graph = reader(unwrap(addProperty(createGraph(), speed)), registry, 'r1')
    const withoutProperty: Graph = { ...graph, properties: [] }
    const { backend } = createStringBackend()

    const result = compile(withoutProperty, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('r1'), portId: 'out' },
    })

    expect(!result.ok && result.errors.map(({ nodeId, code }) => ({ nodeId, code }))).toEqual([
      { nodeId: 'r1', code: 'missing-property' },
    ])
  })

  it('non-reader nodes build with a null property', () => {
    const receivedNullProperty: boolean[] = []
    const probe = defineNode({
      type: 'test/property-probe',
      category: 'utility',
      label: 'Probe',
      description: 'Reports ctx.property',
      keywords: [],
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
      build: ({ tsl, property }) => {
        receivedNullProperty.push(property === null)
        return { out: tsl.construct('float', [0]) }
      },
    })
    const registry = createRegistry(probe)
    const graph = withNodes(registry, [['p', 'test/property-probe']])
    const { backend } = createStringBackend()

    compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('p'), portId: 'out' },
    })

    expect(receivedNullProperty).toEqual([true])
  })
})

describe('compile nameOutput', () => {
  it('nameOutput is called once per evaluated output and its result flows downstream', () => {
    const registry = createRegistry()
    let graph = withNodes(registry, [
      ['c1', 'test/color'],
      ['l', 'test/lerp'],
    ])
    graph = link(graph, registry, 'e1', ['c1', 'out'], ['l', 'a'])
    graph = link(graph, registry, 'e2', ['c1', 'out'], ['l', 'b'])
    graph = link(graph, registry, 'e3', ['l', 'out'], [MASTER_NODE_ID, 'baseColor'])
    const named: string[] = []
    const { backend } = createStringBackend({
      nameOutput: (node, definition, portId, expression) => {
        named.push(`${node.id}.${portId}:${definition.type}=${expression}`)
        return `id(${node.id}.${portId})`
      },
    })

    const result = compile(graph, registry, backend, { kind: 'master' })

    expect(named).toEqual([
      'c1.out:test/color=u(c1:color)',
      'l.out:test/lerp=mix(id(c1.out),id(c1.out),u(l:t))',
    ])
    expect(expectMasterSlots(result).baseColor).toBe('id(l.out)')
  })

  it('does not name the master target slots', () => {
    const registry = createRegistry()
    const named: string[] = []
    const { backend } = createStringBackend({
      nameOutput: (node, _definition, portId, expression) => {
        named.push(node.id)
        return expression
      },
    })

    compile(createGraph(), registry, backend, { kind: 'master' })

    expect(named).toEqual([])
  })

  it('a throwing nameOutput yields build-failed on that node', () => {
    const registry = createRegistry()
    const graph = withNodes(registry, [['c', 'test/color']])
    const { backend } = createStringBackend({
      nameOutput: () => {
        throw new Error('naming failed')
      },
    })

    const result = compile(graph, registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('c'), portId: 'out' },
    })

    expect(result).toEqual({
      ok: false,
      errors: [{ nodeId: 'c', code: 'build-failed', message: 'naming failed' }],
    })
  })
})
