import type { Graph } from '../types/graph'
import { CURRENT_SCHEMA_VERSION } from './schema-version'
import { edgeJson, nodeJson, propertyJson, sortedById, stringify } from './stable-json'

/** Stable text: nodes and edges sorted by id, fixed key order, 2-space indentation. */
export function serializeGraph(graph: Graph): string {
  return stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: Object.fromEntries(
      sortedById(Object.values(graph.nodes)).map((node) => [node.id, nodeJson(node)]),
    ),
    edges: Object.fromEntries(
      sortedById(Object.values(graph.edges)).map((edge) => [edge.id, edgeJson(edge)]),
    ),
    properties: graph.properties.map(propertyJson),
  })
}
