import type { Graph, PortRef } from '../types/graph'
import type { NodeId } from '../types/ids'

/** Node ids reachable by following edges forward from `start` (including `start`). */
function collectReachableNodes(graph: Graph, start: NodeId): ReadonlySet<NodeId> {
  const consumersBySource = new Map<NodeId, NodeId[]>()
  for (const edge of Object.values(graph.edges)) {
    const consumers = consumersBySource.get(edge.from.nodeId) ?? []
    consumers.push(edge.to.nodeId)
    consumersBySource.set(edge.from.nodeId, consumers)
  }

  const visited = new Set<NodeId>()
  const pending: NodeId[] = [start]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (visited.has(next)) continue
    visited.add(next)
    pending.push(...(consumersBySource.get(next) ?? []))
  }
  return visited
}

/**
 * Whether adding an edge `from -> to` would close a loop: a forward walk from the target node
 * reaches the source node. A self connection counts as a cycle (callers report `same-node` first).
 */
export function wouldCreateCycle(graph: Graph, from: PortRef, to: PortRef): boolean {
  return collectReachableNodes(graph, to.nodeId).has(from.nodeId)
}
