import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph, GraphEdge, GraphNode } from '../types/graph'
import { asEdgeId, asNodeId } from '../types/ids'
import { concrete, float, generic, vec2, vec3 } from '../values/port-value-factories'
import { portKey } from './port-key'
import { resolvePortTypes } from './resolve-port-types'

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

const genericWithFallback = defineNode({
  type: 'test/generic-fallback',
  category: 'math',
  label: 'Generic with fallback',
  description: 'A generic input that defaults to a builtin',
  keywords: [],
  inputs: [
    {
      id: 'a',
      label: 'A',
      type: generic('T'),
      default: float(0),
      fallback: 'normalView',
    },
    { id: 'b', label: 'B', type: generic('T'), default: float(0) },
  ],
  outputs: [{ id: 'out', label: 'Out', type: generic('T') }],
  build: ({ tsl, inputs }) => ({ out: tsl.add(inputs.a, inputs.b) }),
})

const uvFallback = defineNode({
  type: 'test/uv-fallback',
  category: 'math',
  label: 'UV fallback',
  description: 'A lone generic input that defaults to the mesh UV',
  keywords: [],
  inputs: [{ id: 'in', label: 'In', type: generic('T'), default: float(0), fallback: 'uv' }],
  outputs: [{ id: 'out', label: 'Out', type: generic('T') }],
  build: ({ inputs }) => ({ out: inputs.in }),
})

const concreteFallback = defineNode({
  type: 'test/concrete-fallback',
  category: 'math',
  label: 'Concrete fallback',
  description: 'A vec2 input that defaults to the mesh UV',
  keywords: [],
  inputs: [{ id: 'uv', label: 'UV', type: concrete('vec2'), default: vec2(0, 0), fallback: 'uv' }],
  outputs: [{ id: 'out', label: 'Out', type: concrete('float') }],
  build: ({ tsl }) => ({ out: tsl.construct('float', [0]) }),
})

const createRegistry = () => {
  const registry = createNodeRegistry()
  registry.register(floatSource)
  registry.register(vec3Source)
  registry.register(add)
  registry.register(genericWithFallback)
  registry.register(uvFallback)
  registry.register(concreteFallback)
  return registry
}

const node = (id: string, type: string, overrides: Partial<GraphNode> = {}): GraphNode => ({
  id: asNodeId(id),
  type,
  position: { x: 0, y: 0 },
  inputValues: {},
  params: {},
  ...overrides,
})

const edge = (id: string, from: [string, string], to: [string, string]): GraphEdge => ({
  id: asEdgeId(id),
  from: { nodeId: asNodeId(from[0]), portId: from[1] },
  to: { nodeId: asNodeId(to[0]), portId: to[1] },
})

const createGraph = (nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Graph => ({
  schemaVersion: 2,
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  edges: Object.fromEntries(edges.map((e) => [e.id, e])),
  properties: [],
})

const key = (nodeId: string, portId: string) => portKey({ nodeId: asNodeId(nodeId), portId })

describe('resolvePortTypes', () => {
  it('unconnected generic resolves from inline defaults', () => {
    const graph = createGraph([node('add', 'test/add')], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.outputs.get(key('add', 'out'))).toBe('float')
    expect(resolved.inputs.get(key('add', 'a'))).toBe('float')
  })

  it('resolves from inline values when nothing is connected', () => {
    const graph = createGraph([node('add', 'test/add', { inputValues: { a: vec3(1, 2, 3) } })], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.outputs.get(key('add', 'out'))).toBe('vec3')
    expect(resolved.inputs.get(key('add', 'b'))).toBe('vec3')
  })

  it('connected vec3 widens the whole group', () => {
    const graph = createGraph(
      [node('src', 'test/vec3-source'), node('add', 'test/add')],
      [edge('e1', ['src', 'out'], ['add', 'a'])],
    )

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.inputs.get(key('add', 'a'))).toBe('vec3')
    expect(resolved.inputs.get(key('add', 'b'))).toBe('vec3')
    expect(resolved.outputs.get(key('add', 'out'))).toBe('vec3')
  })

  it('mixed float and vec3 sources widen to vec3', () => {
    const graph = createGraph(
      [node('f', 'test/float-source'), node('v', 'test/vec3-source'), node('add', 'test/add')],
      [edge('e1', ['f', 'out'], ['add', 'a']), edge('e2', ['v', 'out'], ['add', 'b'])],
    )

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.outputs.get(key('add', 'out'))).toBe('vec3')
  })

  it('concrete ports take their declared type', () => {
    const graph = createGraph([node('src', 'test/vec3-source')], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.outputs.get(key('src', 'out'))).toBe('vec3')
  })

  it('chained generics propagate', () => {
    const graph = createGraph(
      [node('src', 'test/vec3-source'), node('add1', 'test/add'), node('add2', 'test/add')],
      [edge('e1', ['src', 'out'], ['add1', 'a']), edge('e2', ['add1', 'out'], ['add2', 'a'])],
    )

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.outputs.get(key('add1', 'out'))).toBe('vec3')
    expect(resolved.outputs.get(key('add2', 'out'))).toBe('vec3')
  })

  it('resolves chains regardless of node id order', () => {
    const graph = createGraph(
      [node('z-src', 'test/vec3-source'), node('a-add', 'test/add')],
      [edge('e1', ['z-src', 'out'], ['a-add', 'a'])],
    )

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.outputs.get(key('a-add', 'out'))).toBe('vec3')
  })

  it('disconnecting reverts to default type', () => {
    const nodes = [node('src', 'test/vec3-source'), node('add', 'test/add')]
    const registry = createRegistry()
    const connected = createGraph(nodes, [edge('e1', ['src', 'out'], ['add', 'a'])])
    const disconnected = createGraph(nodes, [])

    expect(resolvePortTypes(connected, registry).outputs.get(key('add', 'out'))).toBe('vec3')
    expect(resolvePortTypes(disconnected, registry).outputs.get(key('add', 'out'))).toBe('float')
  })

  it('gives an unconnected input with a fallback the type of its builtin, not of its inline value', () => {
    const graph = createGraph([node('g', 'test/generic-fallback')], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.inputs.get(key('g', 'a'))).toBe('vec3')
    expect(resolved.inputs.get(key('g', 'b'))).toBe('vec3')
    expect(resolved.outputs.get(key('g', 'out'))).toBe('vec3')
  })

  it('takes a vec2 for a uv fallback', () => {
    const graph = createGraph([node('g', 'test/uv-fallback')], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.inputs.get(key('g', 'in'))).toBe('vec2')
    expect(resolved.outputs.get(key('g', 'out'))).toBe('vec2')
  })

  it('lets a connected source override the fallback type', () => {
    const graph = createGraph(
      [node('src', 'test/float-source'), node('g', 'test/uv-fallback')],
      [edge('e1', ['src', 'out'], ['g', 'in'])],
    )

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.inputs.get(key('g', 'in'))).toBe('float')
    expect(resolved.outputs.get(key('g', 'out'))).toBe('float')
  })

  it('leaves a concrete input with a fallback at its declared type', () => {
    const graph = createGraph([node('c', 'test/concrete-fallback')], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.inputs.get(key('c', 'uv'))).toBe('vec2')
  })

  it('skips nodes whose definition is missing', () => {
    const graph = createGraph([node('ghost', 'test/unknown')], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.inputs.size).toBe(0)
    expect(resolved.outputs.size).toBe(0)
  })
})
