import type { Graph } from '../types/graph'
import type { NodeId, PropertyId } from '../types/ids'
import { PROPERTY_ID_PARAM } from '../types/param-definition'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import type { PropertyError } from './property-error'

/**
 * Removes the property together with every node that reads it (`params.propertyId === id`) and
 * the edges touching those nodes, in one operation so the graph never holds a dangling reference.
 */
export function removeProperty(graph: Graph, id: PropertyId): Result<Graph, PropertyError> {
  if (!graph.properties.some((property) => property.id === id)) {
    return err({ code: 'property-not-found', id })
  }

  const readerIds = new Set<NodeId>(
    Object.values(graph.nodes)
      .filter((node) => node.params[PROPERTY_ID_PARAM] === id)
      .map((node) => node.id),
  )
  const keptNodes = Object.values(graph.nodes).filter((node) => !readerIds.has(node.id))
  const keptEdges = Object.values(graph.edges).filter(
    (edge) => !readerIds.has(edge.from.nodeId) && !readerIds.has(edge.to.nodeId),
  )

  return ok({
    ...graph,
    nodes: Object.fromEntries(keptNodes.map((node) => [node.id, node])),
    edges: Object.fromEntries(keptEdges.map((edge) => [edge.id, edge])),
    properties: graph.properties.filter((property) => property.id !== id),
  })
}
