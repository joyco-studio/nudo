import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, XY } from '../types/graph'
import type { NodeId, NodeTypeId } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
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
  if (registry.get(input.type) === undefined)
    return err({ code: 'unknown-node-type', type: input.type })
  if (graph.nodes[input.id] !== undefined) return err({ code: 'duplicate-id', id: input.id })

  const node = {
    id: input.id,
    type: input.type,
    position: input.position,
    inputValues: {},
    params: {},
  }
  return ok({ ...graph, nodes: { ...graph.nodes, [input.id]: node } })
}
