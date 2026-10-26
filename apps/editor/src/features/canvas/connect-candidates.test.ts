import { MASTER_NODE_ID, addNode, asEdgeId, asNodeId, connect, createGraph } from '@nudo-tsl/core'
import type { Graph, NodeId, PortRef } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '../../store/registry'
import { edgesAttachedTo, listConnectCandidates } from './connect-candidates'
import type { ConnectCandidate, ConnectOrigin } from './connect-candidates'

const TIME_ID = asNodeId('time')
const SINE_ID = asNodeId('sine')
const SECOND_SINE_ID = asNodeId('sine-2')

function unwrap(result: { ok: true; value: Graph } | { ok: false; error: unknown }): Graph {
  if (!result.ok) throw new Error(`Graph operation failed: ${JSON.stringify(result.error)}`)
  return result.value
}

function withNode(graph: Graph, id: NodeId, type: string): Graph {
  return unwrap(addNode(graph, registry, { id, type, position: { x: 0, y: 0 } }))
}

function withEdge(graph: Graph, id: string, from: PortRef, to: PortRef): Graph {
  return unwrap(connect(graph, registry, { id: asEdgeId(id), from, to }))
}

const output = (nodeId: NodeId, portId = 'out'): ConnectOrigin => ({
  side: 'output',
  ref: { nodeId, portId },
})
const input = (nodeId: NodeId, portId = 'in'): ConnectOrigin => ({
  side: 'input',
  ref: { nodeId, portId },
})

function labels(candidates: readonly ConnectCandidate[]): string[] {
  return candidates.map((candidate) => candidate.label)
}

describe('listConnectCandidates', () => {
  const graph = withNode(withNode(createGraph(), TIME_ID, 'input/time'), SINE_ID, 'math/sin')

  it('lists every input an output can feed as "Node › Port · type"', () => {
    const found = labels(listConnectCandidates(graph, registry, output(TIME_ID)))

    expect(found).toContain('Sine › In · float')
    expect(found).toContain('Master Stack › Roughness · float')
  })

  it('names the port and node of each candidate', () => {
    const candidates = listConnectCandidates(graph, registry, output(TIME_ID))

    const sine = candidates.find((candidate) => candidate.label === 'Sine › In · float')
    expect(sine?.ref).toEqual({ nodeId: SINE_ID, portId: 'in' })
  })

  it('never offers ports of the origin node itself', () => {
    const found = listConnectCandidates(graph, registry, output(SINE_ID))

    expect(found.every((candidate) => candidate.ref.nodeId !== SINE_ID)).toBe(true)
  })

  it('lists outputs when starting from an input', () => {
    const found = listConnectCandidates(graph, registry, input(SINE_ID))

    expect(labels(found)).toEqual([
      'Time › Out · float',
      'Time › Sine Time · float',
      'Time › Cosine Time · float',
      'Time › Delta Time · float',
    ])
    expect(found[0]?.ref).toEqual({ nodeId: TIME_ID, portId: 'out' })
  })

  it('leaves out connections that would create a cycle', () => {
    const chained = withEdge(
      withNode(graph, SECOND_SINE_ID, 'math/sin'),
      'first-to-second',
      { nodeId: SINE_ID, portId: 'out' },
      { nodeId: SECOND_SINE_ID, portId: 'in' },
    )

    const fromSecond = listConnectCandidates(chained, registry, output(SECOND_SINE_ID))

    expect(fromSecond.some((candidate) => candidate.ref.nodeId === SINE_ID)).toBe(false)
  })

  it('numbers nodes that share a title so every row is distinct', () => {
    const twoSines = withNode(graph, SECOND_SINE_ID, 'math/sin')

    const found = labels(listConnectCandidates(twoSines, registry, output(TIME_ID)))

    expect(found).toContain('Sine (1) › In · float')
    expect(found).toContain('Sine (2) › In · float')
    expect(new Set(found).size).toBe(found.length)
  })

  it('offers the master like any other node', () => {
    const found = listConnectCandidates(graph, registry, output(TIME_ID))

    expect(found.some((candidate) => candidate.ref.nodeId === MASTER_NODE_ID)).toBe(true)
  })
})

describe('edgesAttachedTo', () => {
  const connected = withEdge(
    withEdge(
      withNode(withNode(createGraph(), TIME_ID, 'input/time'), SINE_ID, 'math/sin'),
      'time-to-sine',
      { nodeId: TIME_ID, portId: 'out' },
      { nodeId: SINE_ID, portId: 'in' },
    ),
    'time-to-roughness',
    { nodeId: TIME_ID, portId: 'out' },
    { nodeId: MASTER_NODE_ID, portId: 'roughness' },
  )

  it('finds the one edge feeding an input', () => {
    expect(edgesAttachedTo(connected, input(SINE_ID))).toEqual(['time-to-sine'])
  })

  it('finds every edge leaving an output', () => {
    expect(edgesAttachedTo(connected, output(TIME_ID)).slice().sort()).toEqual([
      'time-to-roughness',
      'time-to-sine',
    ])
  })

  it('finds nothing on a port with no edge', () => {
    expect(edgesAttachedTo(connected, output(SINE_ID))).toEqual([])
  })
})
