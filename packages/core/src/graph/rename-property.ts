import type { Graph } from '../types/graph'
import type { PropertyId } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { isValidIdentifier } from '../validation/is-valid-identifier'
import type { PropertyError } from './property-error'
import { updateProperty } from './update-property'

/** Changes the reference name (the JS identifier). Labels are changed by `setPropertyLabel`. */
export function renameProperty(
  graph: Graph,
  id: PropertyId,
  name: string,
): Result<Graph, PropertyError> {
  return updateProperty(graph, id, (property) => {
    if (!isValidIdentifier(name)) return err({ code: 'invalid-name', name })
    const isTaken = graph.properties.some(
      (existing) => existing.id !== id && existing.name === name,
    )
    if (isTaken) return err({ code: 'duplicate-name', name })
    return ok({ ...property, name })
  })
}
