import { MASTER_NODE_ID, addNode, asEdgeId, asNodeId, connect, createGraph } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { connectedSourceTitle, inspectorSubject } from './inspector-model'

const TIME = asNodeId('time')
const SINE = asNodeId('sine')

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

function timeToSine(): Graph {
  let graph = createGraph()
  graph = unwrap(
    addNode(graph, registry, { id: TIME, type: 'input/time', position: { x: 0, y: 0 } }),
  )
  graph = unwrap(addNode(graph, registry, { id: SINE, type: 'math/sin', position: { x: 0, y: 0 } }))
  return unwrap(
    connect(graph, registry, {
      id: asEdgeId('edge'),
      from: { nodeId: TIME, portId: 'out' },
      to: { nodeId: SINE, portId: 'in' },
    }),
  )
}

describe('inspectorSubject', () => {
  it('shows graph settings while nothing is selected', () => {
    expect(inspectorSubject(createGraph(), registry, [])).toEqual({ kind: 'graph' })
  })

  it('shows the one selected node with its definition', () => {
    const subject = inspectorSubject(timeToSine(), registry, [SINE])
    expect(subject.kind).toBe('node')
    if (subject.kind !== 'node') return
    expect(subject.node.id).toBe(SINE)
    expect(subject.definition.type).toBe('math/sin')
  })

  it('counts a selection of several nodes', () => {
    expect(inspectorSubject(timeToSine(), registry, [TIME, SINE, MASTER_NODE_ID])).toEqual({
      kind: 'selection',
      count: 3,
    })
  })

  it('falls back to graph settings when the selected node no longer exists', () => {
    expect(inspectorSubject(createGraph(), registry, [SINE])).toEqual({ kind: 'graph' })
  })
})

describe('connectedSourceTitle', () => {
  it('names the node that feeds a connected input', () => {
    expect(connectedSourceTitle(timeToSine(), registry, { nodeId: SINE, portId: 'in' })).toBe(
      'Time',
    )
  })

  it('is null for an input with nothing connected', () => {
    expect(
      connectedSourceTitle(timeToSine(), registry, { nodeId: MASTER_NODE_ID, portId: 'baseColor' }),
    ).toBeNull()
  })
})
