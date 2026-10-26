import type { NodeRegistry } from '../registry/node-registry'
import { portKey } from '../type-inference/port-key'
import type { Graph, GraphNode } from '../types/graph'
import { PROPERTY_ID_PARAM, UNIVERSAL_PARAM_IDS } from '../types/param-definition'
import type { ParamDefinition } from '../types/param-definition'

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const isHiddenParam = (param: ParamDefinition): boolean =>
  (param.kind === 'string' || param.kind === 'number') &&
  param.hidden === true &&
  param.id !== PROPERTY_ID_PARAM

/**
 * Ids of the params the node's definition declares `hidden`. They are editor-managed state (a
 * comment's title and size), so they never reach the compiled graph. The property reference is the
 * exception: it picks which property a reader compiles to.
 */
function hiddenParamIds(node: GraphNode, registry: NodeRegistry | undefined): ReadonlySet<string> {
  const params = registry?.get(node.type)?.params ?? []
  return new Set(params.filter(isHiddenParam).map((param) => param.id))
}

/** Structural params only: universal and hidden params are editor state and never affect the compile. */
function sortedParams(
  node: GraphNode,
  registry: NodeRegistry | undefined,
): readonly (readonly [string, string | number | boolean])[] {
  const hidden = hiddenParamIds(node, registry)
  return Object.entries(node.params)
    .filter(([paramId]) => !UNIVERSAL_PARAM_IDS.has(paramId) && !hidden.has(paramId))
    .sort(([a], [b]) => compareStrings(a, b))
}

/**
 * Deterministic fingerprint of the graph structure: node ids, types and structural params plus
 * the edges between ports. Positions, inline input values and universal params are excluded
 * because changing them must never trigger a recompilation. With a registry, params that a
 * definition declares `hidden` are excluded too; without one they count as structural.
 */
export function topologyKey(graph: Graph, registry?: NodeRegistry): string {
  const nodes = Object.values(graph.nodes)
    .sort((a, b) => compareStrings(a.id, b.id))
    .map((node) => [node.id, node.type, sortedParams(node, registry)])
  const edges = Object.values(graph.edges)
    .map((edge) => `${portKey(edge.from)}→${portKey(edge.to)}`)
    .sort(compareStrings)
  return JSON.stringify({ nodes, edges })
}
