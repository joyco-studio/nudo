import type { Graph } from '../types/graph'
import type { NodeId } from '../types/ids'

const compareIds = (a: NodeId, b: NodeId): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Kahn's algorithm: sources first, ties broken by node id so the order is deterministic.
 * Assumes the graph is acyclic; nodes that sit on a cycle are left out of the result.
 * Edges that reference missing nodes are ignored.
 */
export function topologicalOrder(graph: Graph): readonly NodeId[] {
  const nodeIds = Object.values(graph.nodes).map((node) => node.id)
  const knownIds = new Set<NodeId>(nodeIds)
  const pendingInputs = new Map<NodeId, number>(nodeIds.map((id) => [id, 0]))
  const consumers = new Map<NodeId, NodeId[]>(nodeIds.map((id) => [id, []]))

  for (const edge of Object.values(graph.edges)) {
    const { nodeId: source } = edge.from
    const { nodeId: target } = edge.to
    if (!knownIds.has(source) || !knownIds.has(target)) continue
    consumers.get(source)?.push(target)
    pendingInputs.set(target, (pendingInputs.get(target) ?? 0) + 1)
  }

  const ready = nodeIds.filter((id) => pendingInputs.get(id) === 0).sort(compareIds)
  const order: NodeId[] = []

  for (let next = ready.shift(); next !== undefined; next = ready.shift()) {
    order.push(next)
    for (const consumer of consumers.get(next) ?? []) {
      const remaining = (pendingInputs.get(consumer) ?? 0) - 1
      pendingInputs.set(consumer, remaining)
      if (remaining === 0) ready.push(consumer)
    }
    ready.sort(compareIds)
  }

  return order
}
