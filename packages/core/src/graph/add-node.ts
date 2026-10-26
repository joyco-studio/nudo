import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, XY } from '../types/graph'
import type { NodeId, NodeTypeId } from '../types/ids'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { defaultParams } from './default-params'
import type { GraphError } from './graph-error'

export interface AddNodeInput {
  readonly id: NodeId
  readonly type: NodeTypeId
  readonly position: XY
}

export function addNode(
  graph: Graph,
  registry: NodeRegistry,
  input: AddNodeInput,
): Result<Graph, GraphError> {
  const definition = registry.get(input.type)
  if (definition === undefined) return err({ code: 'unknown-node-type', type: input.type })
  // Only one master can exist, and createGraph already provides it.
  if (input.type === MASTER_NODE_TYPE) return err({ code: 'duplicate-id', id: MASTER_NODE_ID })
  // Property readers need a valid `propertyId`, which only `addPropertyNode` can guarantee.
  if (definition.reads === 'property') return err({ code: 'property-required' })
  if (graph.nodes[input.id] !== undefined) return err({ code: 'duplicate-id', id: input.id })

  const node = {
    id: input.id,
    type: input.type,
    position: input.position,
    inputValues: {},
    params: defaultParams(definition),
  }
  return ok({ ...graph, nodes: { ...graph.nodes, [input.id]: node } })
}
