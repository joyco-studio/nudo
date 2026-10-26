import type { Graph } from '../types/graph'
import type { PropertyId } from '../types/ids'
import type { Result } from '../types/result'
import { ok } from '../types/result'
import type { PropertyError } from './property-error'
import { updateProperty } from './update-property'

export function setPropertyLabel(
  graph: Graph,
  id: PropertyId,
  label: string,
): Result<Graph, PropertyError> {
  return updateProperty(graph, id, (property) => ok({ ...property, label }))
}
