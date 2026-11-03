import { MASTER_NODE_ID, addNode, asNodeId, createGraph } from '@nudo-tsl/core'
import type { Graph, XY } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { registry } from '@/store/registry'
import { BESIDE_NODE_OFFSET_X } from '@/features/add-node-menu/add-node-placement'
import { placeForAgent } from './agent-placement'

function withNode(graph: Graph, id: string, position: XY): Graph {
  const result = addNode(graph, registry, { id: asNodeId(id), type: 'math/add', position })
  if (!result.ok) throw new Error(`Could not add ${id}`)
  return result.value
}

describe('placeForAgent', () => {
  it('places to the left of the master when nothing was touched', () => {
    const graph = createGraph()
    const master = graph.nodes[MASTER_NODE_ID]?.position ?? { x: 0, y: 0 }

    expect(placeForAgent(graph, null)).toEqual({ x: master.x - BESIDE_NODE_OFFSET_X, y: master.y })
  })

  it('places to the left of the node it is near', () => {
    const graph = withNode(createGraph(), 'a', { x: 1000, y: 500 })

    expect(placeForAgent(graph, asNodeId('a'))).toEqual({
      x: 1000 - BESIDE_NODE_OFFSET_X,
      y: 500,
    })
  })

  it('falls back to the master when the near node is gone', () => {
    const graph = createGraph()

    expect(placeForAgent(graph, asNodeId('gone'))).toEqual(placeForAgent(graph, null))
  })

  it('does not land on top of an existing node', () => {
    const base = createGraph()
    const first = placeForAgent(base, null)
    const graph = withNode(base, 'blocker', first)

    const spot = placeForAgent(graph, null)

    expect(spot).not.toEqual(first)
    expect(spot.x).toBeGreaterThan(first.x)
  })
})
