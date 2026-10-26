import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, ParamValue, XY } from '../types/graph'
import type { NodeId, NodeTypeId } from '../types/ids'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'
import type { AnyNodeDefinition } from '../types/node-definition'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import type { GraphError } from './graph-error'

/** Enum and boolean params start at their default; string and number params stay absent. */
function defaultParams(definition: AnyNodeDefinition): Readonly<Record<string, ParamValue>> {
  const defaults = (definition.params ?? []).flatMap((param): [string, ParamValue][] =>
    param.kind === 'enum' || param.kind === 'boolean' ? [[param.id, param.default]] : [],
  )
  return Object.fromEntries(defaults)
}

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
