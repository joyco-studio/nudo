import type { BlackboardProperty } from '../types/blackboard-property'
import type { Graph } from '../types/graph'
import type { PropertyId } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import type { PropertyError } from './property-error'

/** Replaces one property with the result of `update`, keeping list order. */
export function updateProperty(
  graph: Graph,
  id: PropertyId,
  update: (property: BlackboardProperty) => Result<BlackboardProperty, PropertyError>,
): Result<Graph, PropertyError> {
  const current = graph.properties.find((property) => property.id === id)
  if (current === undefined) return err({ code: 'property-not-found', id })

  const updated = update(current)
  if (!updated.ok) return updated
  return ok({
    ...graph,
    properties: graph.properties.map((property) => (property.id === id ? updated.value : property)),
  })
}
