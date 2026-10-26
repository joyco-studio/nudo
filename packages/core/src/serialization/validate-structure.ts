import { topologicalOrder } from '../graph/topological-order'
import type { GraphEdge, GraphNode } from '../types/graph'
import type { Result } from '../types/result'
import { ok } from '../types/result'
import { invalidShape } from './json-guards'
import type { ParseError } from './schema-version'

/** Kahn's order leaves cycle members out, so a short order means the edges loop. */
const hasCycle = (nodes: readonly GraphNode[], edges: readonly GraphEdge[]): boolean =>
  topologicalOrder({
    schemaVersion: 1,
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    // Keyed by position, not id: duplicate edge ids must not hide an edge from the cycle check.
    edges: Object.fromEntries(edges.map((edge, index) => [String(index), edge])),
    properties: [],
  }).length < nodes.length

/**
 * Rejects edges whose endpoints are missing and edge sets that form a cycle. The compiler has no
 * cycle guard, so corrupt data must never get past parsing.
 */
export function validateEdgeStructure(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  pathOfEdge: (edge: GraphEdge, index: number) => string,
): Result<void, ParseError> {
  const nodeIds = new Set(nodes.map((node) => node.id))
  for (const [index, edge] of edges.entries()) {
    if (!nodeIds.has(edge.from.nodeId) || !nodeIds.has(edge.to.nodeId)) {
      return invalidShape(pathOfEdge(edge, index))
    }
  }
  return hasCycle(nodes, edges) ? invalidShape('edges') : ok(undefined)
}
