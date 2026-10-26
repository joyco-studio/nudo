import type { Graph } from '../types/graph'
import type { PropertyId } from '../types/ids'
import type { PortValue } from '../types/port-value'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import type { PropertyError } from './property-error'
import { updateProperty } from './update-property'

/** Replaces the value; it must keep the property's declared type. */
export function setPropertyValue(
  graph: Graph,
  id: PropertyId,
  value: PortValue,
): Result<Graph, PropertyError> {
  return updateProperty(graph, id, (property) =>
    value.type === property.type ? ok({ ...property, value }) : err({ code: 'type-mismatch' }),
  )
}
