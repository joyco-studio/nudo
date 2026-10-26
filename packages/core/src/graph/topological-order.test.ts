import { describe, expect, it } from 'vitest'
import type { Graph, GraphEdge, GraphNode } from '../types/graph'
import { asEdgeId, asNodeId } from '../types/ids'
import { topologicalOrder } from './topological-order'

const node = (id: string): GraphNode => ({
  id: asNodeId(id),
  type: 'test/node',
  position: { x: 0, y: 0 },
  inputValues: {},
  params: {},
})

const edge = (from: string, to: string): GraphEdge => ({
  id: asEdgeId(`${from}->${to}`),
  from: { nodeId: asNodeId(from), portId: 'out' },
  to: { nodeId: asNodeId(to), portId: 'in' },
})

const createGraph = (ids: readonly string[], edges: readonly GraphEdge[]): Graph => ({
  schemaVersion: 1,
  nodes: Object.fromEntries(ids.map((id) => [id, node(id)])),
  edges: Object.fromEntries(edges.map((e) => [e.id, e])),
  properties: [],
})

describe('topologicalOrder', () => {
  it('puts sources before their consumers', () => {
    const graph = createGraph(['a', 'b', 'c'], [edge('c', 'b'), edge('b', 'a')])

    expect(topologicalOrder(graph)).toEqual(['c', 'b', 'a'])
  })

  it('breaks ties by node id', () => {
    const graph = createGraph(['m', 'b', 'x', 'a'], [])

    expect(topologicalOrder(graph)).toEqual(['a', 'b', 'm', 'x'])
  })

  it('handles diamonds', () => {
    const graph = createGraph(
      ['d', 'b', 'c', 'a'],
      [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')],
    )

    expect(topologicalOrder(graph)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores edges that reference missing nodes', () => {
    const graph = createGraph(['a', 'b'], [edge('ghost', 'a')])

    expect(topologicalOrder(graph)).toEqual(['a', 'b'])
  })
})
