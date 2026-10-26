import { topologicalOrder } from '../graph/topological-order'
import type { NodeRegistry } from '../registry/node-registry'
import { portKey } from '../type-inference/port-key'
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

/** Whether the edge leaves a real output of its source and enters a real input of its target. */
function connectsDefinedPorts(
  edge: GraphEdge,
  nodesById: ReadonlyMap<string, GraphNode>,
  registry: NodeRegistry,
): boolean {
  const source = nodesById.get(edge.from.nodeId)
  const target = nodesById.get(edge.to.nodeId)
  if (source === undefined || target === undefined) return false
  const sourceDefinition = registry.get(source.type)
  const targetDefinition = registry.get(target.type)
  if (sourceDefinition === undefined || targetDefinition === undefined) return false
  return (
    sourceDefinition.outputs.some((output) => output.id === edge.from.portId) &&
    targetDefinition.inputs.some((input) => input.id === edge.to.portId)
  )
}

/**
 * Rejects edges whose endpoints are missing or name ports their node does not define, inputs fed
 * by more than one edge, and edge sets that form a cycle. The compiler has no cycle guard and
 * reads one source per input, so corrupt data must never get past parsing.
 */
export function validateEdgeStructure(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  registry: NodeRegistry,
  pathOfEdge: (edge: GraphEdge, index: number) => string,
): Result<void, ParseError> {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const fedInputs = new Set<string>()
  for (const [index, edge] of edges.entries()) {
    const inputKey = portKey(edge.to)
    if (!connectsDefinedPorts(edge, nodesById, registry) || fedInputs.has(inputKey)) {
      return invalidShape(pathOfEdge(edge, index))
    }
    fedInputs.add(inputKey)
  }
  return hasCycle(nodes, edges) ? invalidShape('edges') : ok(undefined)
}
