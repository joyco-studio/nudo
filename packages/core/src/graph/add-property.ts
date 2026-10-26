import type { BlackboardProperty } from '../types/blackboard-property'
import type { Graph } from '../types/graph'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { isValidIdentifier } from '../validation/is-valid-identifier'
import type { PropertyError } from './property-error'

/**
 * Appends a property. The name must be a valid identifier unique among properties, the id must be
 * unused, and the value must match the declared type.
 */
export function addProperty(
  graph: Graph,
  property: BlackboardProperty,
): Result<Graph, PropertyError> {
  if (!isValidIdentifier(property.name)) return err({ code: 'invalid-name', name: property.name })
  if (graph.properties.some((existing) => existing.id === property.id)) {
    return err({ code: 'duplicate-id', id: property.id })
  }
  if (graph.properties.some((existing) => existing.name === property.name)) {
    return err({ code: 'duplicate-name', name: property.name })
  }
  if (property.value.type !== property.type) return err({ code: 'type-mismatch' })

  return ok({ ...graph, properties: [...graph.properties, property] })
}
