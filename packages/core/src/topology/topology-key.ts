import { hasOffAtZeroInputs, zeroInputIds } from '../compiler/zero-inputs'
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
 * The node's `offAtZero` inputs that are switched off, sorted; `null` when its definition has
 * none (or is unknown), so the fingerprint of every other node stays as it was.
 */
function zeroedInputs(
  node: GraphNode,
  registry: NodeRegistry | undefined,
  connected: ReadonlySet<string>,
): readonly string[] | null {
  const definition = registry?.get(node.type)
  if (definition === undefined || !hasOffAtZeroInputs(definition)) return null
  const isConnected = (inputId: string): boolean =>
    connected.has(portKey({ nodeId: node.id, portId: inputId }))
  return [...zeroInputIds(node, definition, isConnected)].sort(compareStrings)
}

/**
 * Deterministic fingerprint of the graph structure: node ids, types and structural params plus
 * the edges between ports. Positions, inline input values and universal params are excluded
 * because changing them must never trigger a recompilation. With a registry, params that a
 * definition declares `editorOnly` are excluded too; without one they count as structural. Also
 * with a registry, an `offAtZero` input counts by whether it is 0 (not by its value), since the
 * node builds without it then.
 */
export function topologyKey(graph: Graph, registry?: NodeRegistry): string {
  const connected = new Set(Object.values(graph.edges).map((edge) => portKey(edge.to)))
  const nodes = Object.values(graph.nodes)
    .sort((a, b) => compareStrings(a.id, b.id))
    .map((node) => {
      const zeroed = zeroedInputs(node, registry, connected)
      const key = [node.id, node.type, sortedParams(node, registry)]
      return zeroed === null ? key : [...key, zeroed]
    })
  const edges = Object.values(graph.edges)
    .map((edge) => `${portKey(edge.from)}→${portKey(edge.to)}`)
    .sort(compareStrings)
  return JSON.stringify({ nodes, edges })
}
