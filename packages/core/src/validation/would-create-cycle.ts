import { repeatLinks } from '../repeat/repeat-zone'
import type { Graph, PortRef } from '../types/graph'
import type { NodeId } from '../types/ids'

/**
 * Node ids reachable by following edges forward from `start` (including `start`), with each Repeat
 * zone counted as an edge from its Repeat Input to its Repeat Output.
 */
function collectReachableNodes(graph: Graph, start: NodeId): ReadonlySet<NodeId> {
  const consumersBySource = new Map<NodeId, NodeId[]>()
  const link = (source: NodeId, consumer: NodeId): void => {
    consumersBySource.set(source, [...(consumersBySource.get(source) ?? []), consumer])
  }
  for (const edge of Object.values(graph.edges)) link(edge.from.nodeId, edge.to.nodeId)
  // A zone's result depends on its starting values: feeding it back into them closes a loop.
  for (const { input, output } of repeatLinks(graph)) link(input, output)

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
