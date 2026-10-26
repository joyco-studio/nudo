import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, GraphEdge, PortRef } from '../types/graph'
import type { EdgeId } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { checkConnection } from '../validation/check-connection'
import type { GraphError } from './graph-error'

export interface ConnectInput {
  readonly id: EdgeId
  readonly from: PortRef
  readonly to: PortRef
}

/** Adds an edge, replacing any edge that already feeds the same input. */
export function connect(
  graph: Graph,
  registry: NodeRegistry,
  input: ConnectInput,
): Result<Graph, GraphError> {
  const check = checkConnection(graph, registry, input.from, input.to)
  if (!check.ok) return err({ code: 'invalid-connection', reason: check.reason })

  const isReplaced = (edge: GraphEdge): boolean =>
    edge.to.nodeId === input.to.nodeId && edge.to.portId === input.to.portId
  const keptEdges = Object.values(graph.edges).filter((edge) => !isReplaced(edge))
  if (keptEdges.some((edge) => edge.id === input.id)) {
    return err({ code: 'duplicate-id', id: input.id })
  }

  const newEdge = { id: input.id, from: input.from, to: input.to }
  return ok({
    ...graph,
    edges: { ...Object.fromEntries(keptEdges.map((edge) => [edge.id, edge])), [input.id]: newEdge },
  })
}
