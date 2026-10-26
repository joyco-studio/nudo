import { describe, expect, it, vi } from 'vitest'
import { addNode } from '../graph/add-node'
import { connect } from '../graph/connect'
import { createGraph } from '../graph/create-graph'
import { disconnect } from '../graph/disconnect'
import { setInputValue } from '../graph/set-input-value'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph, PortRef } from '../types/graph'
import { MASTER_NODE_ID, asEdgeId, asNodeId } from '../types/ids'
import type { PortValue } from '../types/port-value'
import type { Result } from '../types/result'
import type { TslFacade } from '../types/tsl-facade'
import { concrete, float, generic, texture, vec3, vec4 } from '../values/port-value-factories'
import { compile } from './compile'
import type { CompileBackend, CompileResult } from './compile-backend'

const formatParts = (parts: readonly (string | number)[]): string => `[${parts.join(',')}]`

const stringFacade: TslFacade<string> = {
  add: (a, b) => `add(${a},${b})`,
  mul: (a, b) => `mul(${a},${b})`,
  sin: (a) => `sin(${a})`,
  pow: (a, b) => `pow(${a},${b})`,
  oneMinus: (a) => `oneMinus(${a})`,
  clamp: (x, low, high) => `clamp(${x},${low},${high})`,
  dot: (a, b) => `dot(${a},${b})`,
  mix: (a, b, t) => `mix(${a},${b},${t})`,
  builtin: (name) => `builtin(${name})`,
  construct: (type, parts) => `construct(${type},${formatParts(parts)})`,
  swizzle: (value, components) => `swizzle(${value},${components})`,
}

const createStringBackend = () => {
  const receivedValues = new Map<string, PortValue>()
  const backend: CompileBackend<string> = {
    tsl: stringFacade,
    inputValue: (ref, value) => {
      const key = `${ref.nodeId}:${ref.portId}`
      receivedValues.set(key, value)
      return `u(${key})`
    },
  }
  return { backend, receivedValues }
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
})
