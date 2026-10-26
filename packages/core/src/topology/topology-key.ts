import { portKey } from '../type-inference/port-key'
import type { Graph, GraphNode } from '../types/graph'
import { UNIVERSAL_PARAM_IDS } from '../types/param-definition'

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Structural params only: universal params are editor state and never affect the compiled graph. */
const sortedParams = (node: GraphNode): readonly (readonly [string, string | number | boolean])[] =>
  Object.entries(node.params)
    .filter(([paramId]) => !UNIVERSAL_PARAM_IDS.has(paramId))
    .sort(([a], [b]) => compareStrings(a, b))

/**
 * Deterministic fingerprint of the graph structure: node ids, types and structural params plus
 * the edges between ports. Positions, inline input values and universal params are excluded
 * because changing them must never trigger a recompilation.
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
