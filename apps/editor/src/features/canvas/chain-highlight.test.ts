import { MASTER_NODE_ID, addNode, asEdgeId, asNodeId, connect, createGraph } from '@nudo-tsl/core'
import type { Graph, PortRef } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import {
  CHAIN_DIMMED_CLASS,
  CHAIN_EMPHASIZED_CLASS,
  chainClassOf,
  selectionChain,
} from './chain-highlight'

function unwrap(result: { ok: true; value: Graph } | { ok: false; error: unknown }): Graph {
  if (!result.ok) throw new Error(`Graph operation failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const id = asNodeId
const out = (nodeId: string, portId = 'out'): PortRef => ({ nodeId: id(nodeId), portId })

function withNode(graph: Graph, nodeId: string, type: string): Graph {
  return unwrap(addNode(graph, registry, { id: id(nodeId), type, position: { x: 0, y: 0 } }))
}

function withEdge(graph: Graph, edgeId: string, from: PortRef, to: PortRef): Graph {
  return unwrap(connect(graph, registry, { id: asEdgeId(edgeId), from, to }))
}

/**
 * time → sine → master.roughness, uv → noise (unrelated to the sine chain) → master.baseColor,
 * and a comment frame with no edges.
 */
function sampleGraph(): Graph {
  let graph = createGraph()
  for (const [nodeId, type] of [
    ['time', 'input/time'],
    ['sine', 'math/sin'],
    ['uv', 'input/uv'],
    ['noise', 'effects/noise'],
    ['note', 'utility/comment'],
  ] as const) {
    graph = withNode(graph, nodeId, type)
  }
  graph = withEdge(graph, 'time-sine', out('time'), out('sine', 'in'))
  graph = withEdge(graph, 'sine-master', out('sine'), {
    nodeId: MASTER_NODE_ID,
    portId: 'roughness',
  })
  graph = withEdge(graph, 'uv-noise', out('uv'), out('noise', 'p'))
  return withEdge(graph, 'noise-master', out('noise'), {
    nodeId: MASTER_NODE_ID,
    portId: 'metalness',
  })
}

const sorted = (ids: Iterable<string>): string[] => [...ids].sort()

describe('selectionChain', () => {
  it('follows a selected node upstream and downstream, all the way', () => {
    const chain = selectionChain(sampleGraph(), [id('sine')])

    expect(sorted(chain?.nodeIds ?? [])).toEqual(['master', 'sine', 'time'])
    expect(sorted(chain?.edgeIds ?? [])).toEqual(['sine-master', 'time-sine'])
  })

  it('does not climb back up from a downstream node into its other inputs', () => {
    const chain = selectionChain(sampleGraph(), [id('time')])

    expect(chain?.nodeIds.has(id('noise'))).toBe(false)
    expect(chain?.edgeIds.has(asEdgeId('noise-master'))).toBe(false)
  })

  it('joins the chains of every selected node', () => {
    const chain = selectionChain(sampleGraph(), [id('time'), id('uv')])

    expect(sorted(chain?.edgeIds ?? [])).toEqual([
      'noise-master',
      'sine-master',
      'time-sine',
      'uv-noise',
    ])
  })

  it('highlights nothing without a selection, or when the selection has no connections', () => {
    const graph = sampleGraph()

    expect(selectionChain(graph, [])).toBeNull()
    expect(selectionChain(graph, [id('note')])).toBeNull()
    expect(selectionChain(withNode(graph, 'alone', 'math/sin'), [id('alone')])).toBeNull()
  })

  it('ignores selected ids the graph no longer has', () => {
    expect(selectionChain(sampleGraph(), [id('gone')])).toBeNull()
  })
})

describe('chainClassOf', () => {
  const chain = selectionChain(sampleGraph(), [id('sine')])

  it('dims what is outside the chain and emphasizes the chain edges', () => {
    expect(chainClassOf(chain, 'edge', 'time-sine')).toBe(CHAIN_EMPHASIZED_CLASS)
    expect(chainClassOf(chain, 'edge', 'uv-noise')).toBe(CHAIN_DIMMED_CLASS)
    expect(chainClassOf(chain, 'node', 'noise')).toBe(CHAIN_DIMMED_CLASS)
  })

  it('leaves nodes in the chain as they are, and everything when there is no chain', () => {
    expect(chainClassOf(chain, 'node', 'time')).toBeUndefined()
    expect(chainClassOf(null, 'edge', 'uv-noise')).toBeUndefined()
    expect(chainClassOf(null, 'node', 'noise')).toBeUndefined()
  })
})
