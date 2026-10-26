import { portKey } from '../type-inference/port-key'
import type { Graph, GraphNode } from '../types/graph'

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const sortedParams = (node: GraphNode): readonly (readonly [string, string | number | boolean])[] =>
  Object.entries(node.params).sort(([a], [b]) => compareStrings(a, b))

/**
 * Deterministic fingerprint of the graph structure: node ids, types and params plus the edges
 * between ports. Positions and inline input values are excluded because changing them must
 * never trigger a recompilation.
 */
export function topologyKey(graph: Graph): string {
  const nodes = Object.values(graph.nodes)
    .sort((a, b) => compareStrings(a.id, b.id))
    .map((node) => [node.id, node.type, sortedParams(node)])
  const edges = Object.values(graph.edges)
    .map((edge) => `${portKey(edge.from)}→${portKey(edge.to)}`)
    .sort(compareStrings)
  return JSON.stringify({ nodes, edges })
}
