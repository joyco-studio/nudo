import type { Graph } from '../types/graph'
import type { NodeId } from '../types/ids'
import { MASTER_NODE_ID } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import type { GraphError } from './graph-error'

/** Removes the nodes and every edge touching them. The master node can never be removed. */
export function removeNodes(graph: Graph, ids: readonly NodeId[]): Result<Graph, GraphError> {
  if (ids.includes(MASTER_NODE_ID)) return err({ code: 'cannot-remove-master' })

  const missingId = ids.find((id) => graph.nodes[id] === undefined)
  if (missingId !== undefined) return err({ code: 'node-not-found', nodeId: missingId })

  const removed = new Set<NodeId>(ids)
  const keptNodes = Object.values(graph.nodes).filter((node) => !removed.has(node.id))
  const keptEdges = Object.values(graph.edges).filter(
    (edge) => !removed.has(edge.from.nodeId) && !removed.has(edge.to.nodeId),
  )

  return ok({
    ...graph,
    nodes: Object.fromEntries(keptNodes.map((node) => [node.id, node])),
    edges: Object.fromEntries(keptEdges.map((edge) => [edge.id, edge])),
  })
}
