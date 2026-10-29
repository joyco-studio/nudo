import type { NodeRegistry } from '../registry/node-registry'
import { portKey } from '../type-inference/port-key'
import type { Graph, GraphNode } from '../types/graph'
import { UNIVERSAL_PARAM_IDS } from '../types/param-definition'
import type { ParamDefinition } from '../types/param-definition'

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const isEditorOnlyParam = (param: ParamDefinition): boolean =>
  (param.kind === 'string' || param.kind === 'number') && param.editorOnly === true

/**
 * Ids of the params the node's definition declares `editorOnly`: editor state (a comment's title
 * and size) that never reaches the compiled graph. A param that is merely `hidden` from the node
 * body still counts: a Color Ramp's stop count shapes its shader.
 */
function editorOnlyParamIds(
  node: GraphNode,
  registry: NodeRegistry | undefined,
): ReadonlySet<string> {
  const params = registry?.get(node.type)?.params ?? []
  return new Set(params.filter(isEditorOnlyParam).map((param) => param.id))
}

/** Structural params only: universal and editor-only params never affect the compile. */
function sortedParams(
  node: GraphNode,
  registry: NodeRegistry | undefined,
): readonly (readonly [string, string | number | boolean])[] {
  const editorOnly = editorOnlyParamIds(node, registry)
  return Object.entries(node.params)
    .filter(([paramId]) => !UNIVERSAL_PARAM_IDS.has(paramId) && !editorOnly.has(paramId))
    .sort(([a], [b]) => compareStrings(a, b))
}

/**
 * Deterministic fingerprint of the graph structure: node ids, types and structural params plus
 * the edges between ports. Positions, inline input values and universal params are excluded
 * because changing them must never trigger a recompilation. With a registry, params that a
 * definition declares `editorOnly` are excluded too; without one they count as structural.
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
