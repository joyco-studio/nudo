import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, XY } from '../types/graph'
import type { NodeId, PropertyId } from '../types/ids'
import { PROPERTY_ID_PARAM } from '../types/param-definition'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { defaultParams } from './default-params'
import type { GraphError } from './graph-error'

export interface AddPropertyNodeInput {
  readonly id: NodeId
  readonly propertyId: PropertyId
  readonly position: XY
}

/**
 * Adds the reader node of a Blackboard property in one step: the definition is `property/<type>`
 * and `params.propertyId` is set, so the graph never holds a reader without a valid reference.
 */
export function addPropertyNode(
  graph: Graph,
  registry: NodeRegistry,
  input: AddPropertyNodeInput,
): Result<Graph, GraphError> {
  const property = graph.properties.find((candidate) => candidate.id === input.propertyId)
  if (property === undefined) return err({ code: 'property-not-found', id: input.propertyId })
  const type = `property/${property.type}`
  const definition = registry.get(type)
  if (definition?.reads !== 'property') return err({ code: 'unknown-node-type', type })
  if (graph.nodes[input.id] !== undefined) return err({ code: 'duplicate-id', id: input.id })

  const node = {
    id: input.id,
    type,
    position: input.position,
    inputValues: {},
    params: { ...defaultParams(definition), [PROPERTY_ID_PARAM]: input.propertyId },
  }
  return ok({ ...graph, nodes: { ...graph.nodes, [input.id]: node } })
}
