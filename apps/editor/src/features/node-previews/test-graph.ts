import { addNode, asEdgeId, asNodeId, connect, createGraph } from '@nudo-tsl/core'
import type { Graph, NodeId, PortRef, Result } from '@nudo-tsl/core'

import { registry } from '@/store/registry'

/** Test helpers: small graphs built with the real core operations and node registry. */

const ORIGIN = { x: 0, y: 0 }

export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

export const id = (raw: string): NodeId => asNodeId(raw)

export const port = (nodeId: string, portId: string): PortRef => ({
  nodeId: asNodeId(nodeId),
  portId,
})

export const withNode = (graph: Graph, nodeId: string, type: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(nodeId), type, position: ORIGIN }))

export const withEdge = (graph: Graph, from: PortRef, to: PortRef): Graph =>
  unwrap(
    connect(graph, registry, {
      id: asEdgeId(`${from.nodeId}.${from.portId}->${to.nodeId}.${to.portId}`),
      from,
      to,
    }),
  )

/** Nodes by `[id, type]`, added to a fresh graph in order. */
export function graphWith(nodes: readonly (readonly [string, string])[]): Graph {
  return nodes.reduce((graph, [nodeId, type]) => withNode(graph, nodeId, type), createGraph())
}
