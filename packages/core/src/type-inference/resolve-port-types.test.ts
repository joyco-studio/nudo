import { describe, expect, it } from 'vitest'
import { defineNode } from '../registry/define-node'
import { createNodeRegistry } from '../registry/node-registry'
import type { Graph, GraphEdge, GraphNode } from '../types/graph'
import { asEdgeId, asNodeId } from '../types/ids'
import { concrete, float, generic, vec3 } from '../values/port-value-factories'
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

const createRegistry = () => {
  const registry = createNodeRegistry()
  registry.register(floatSource)
  registry.register(vec3Source)
  registry.register(add)
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

  it('skips nodes whose definition is missing', () => {
    const graph = createGraph([node('ghost', 'test/unknown')], [])

    const resolved = resolvePortTypes(graph, createRegistry())

    expect(resolved.inputs.size).toBe(0)
    expect(resolved.outputs.size).toBe(0)
  })
})
