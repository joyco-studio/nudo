import type { Graph } from '../types/graph'
import type { EdgeId } from '../types/ids'

/** Removes the given edges; ids that are not in the graph are ignored. */
export function disconnect(graph: Graph, edgeIds: readonly EdgeId[]): Graph {
  const removed = new Set<EdgeId>(edgeIds)
  const keptEdges = Object.values(graph.edges).filter((edge) => !removed.has(edge.id))
  return { ...graph, edges: Object.fromEntries(keptEdges.map((edge) => [edge.id, edge])) }
}
