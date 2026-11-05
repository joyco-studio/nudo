import { MASTER_NODE_ID, addNode, asEdgeId, asNodeId, connect, createGraph } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { registry } from '@/store/registry'
import { toAgentGraph } from './agent-graph-view'

const A = asNodeId('a')
const B = asNodeId('b')

function buildGraph(): Graph {
  const withA = addNode(createGraph(), registry, {
    id: A,
    type: 'input/float',
    position: { x: 0, y: 0 },
  })
  if (!withA.ok) throw new Error('addNode a failed')
  const withB = addNode(withA.value, registry, {
    id: B,
    type: 'math/add',
    position: { x: 10, y: 5 },
  })
  if (!withB.ok) throw new Error('addNode b failed')
  const connected = connect(withB.value, registry, {
    id: asEdgeId('e1'),
    from: { nodeId: A, portId: 'out' },
    to: { nodeId: B, portId: 'a' },
  })
  if (!connected.ok) throw new Error('connect failed')
  return connected.value
}

describe('toAgentGraph', () => {
  it('marks connected inputs with connectedFrom and omits their value', () => {
    const view = toAgentGraph(buildGraph(), {}, registry)
    const node = view.nodes.find((candidate) => candidate.id === B)
    const connected = node?.inputs.find((input) => input.id === 'a')
    const free = node?.inputs.find((input) => input.id === 'b')

    expect(connected?.connectedFrom).toEqual({ nodeId: A, portId: 'out' })
    expect(connected).not.toHaveProperty('value')
    expect(free?.value).toBeDefined()
    expect(free).not.toHaveProperty('connectedFrom')
    expect(view.edges).toHaveLength(1)
    expect(view.edges[0]).toMatchObject({ from: { nodeId: A }, to: { nodeId: B } })
  })

  it('includes compile errors by node', () => {
    const view = toAgentGraph(buildGraph(), { [MASTER_NODE_ID]: 'boom' }, registry)

    expect(view.errors).toEqual([{ nodeId: MASTER_NODE_ID, message: 'boom' }])
  })
})
