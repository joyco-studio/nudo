import type { Graph } from '../types/graph'
import type { PropertyId } from '../types/ids'
import type { Result } from '../types/result'
import { ok } from '../types/result'
import type { PropertyError } from './property-error'
import { updateProperty } from './update-property'

/** Exposed properties are live uniforms; unexposed ones are inlined by codegen as constants. */
export function setPropertyExposed(
  graph: Graph,
  id: PropertyId,
  exposed: boolean,
): Result<Graph, PropertyError> {
  return updateProperty(graph, id, (property) => ok({ ...property, exposed }))
}
