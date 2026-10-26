import type { Graph, GraphEdge, GraphNode, XY } from '../types/graph'
import type { EdgeId, NodeId } from '../types/ids'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'
import type { GraphFragment } from './graph-fragment'

export interface PasteOptions {
  readonly offset: XY
  /** Must return an id that is not used in the graph; called once per pasted node. */
  createNodeId: () => NodeId
  /** Must return an id that is not used in the graph; called once per pasted edge. */
  createEdgeId: () => EdgeId
}

export interface PasteResult {
  readonly graph: Graph
  readonly pastedNodeIds: readonly NodeId[]
}

/**
 * Adds a copy of the fragment with fresh ids, moved by `offset`. The fragment was validated by
 * `parseFragment` (known types, edges inside the set), so nothing is re-checked here.
 */
export function pasteFragment(
  graph: Graph,
  fragment: GraphFragment,
  options: PasteOptions,
): PasteResult {
  const copyableNodes = fragment.nodes.filter(
    (node) => node.id !== MASTER_NODE_ID && node.type !== MASTER_NODE_TYPE,
  )
  const newIdByOldId = new Map<NodeId, NodeId>(
    copyableNodes.map((node) => [node.id, options.createNodeId()]),
  )

  const pastedNodes = copyableNodes.flatMap((node): GraphNode[] => {
    const id = newIdByOldId.get(node.id)
    if (id === undefined) return []
    const position = {
      x: node.position.x + options.offset.x,
      y: node.position.y + options.offset.y,
    }
    return [{ ...node, id, position }]
  })

  const pastedEdges = fragment.edges.flatMap((edge): GraphEdge[] => {
    const fromId = newIdByOldId.get(edge.from.nodeId)
    const toId = newIdByOldId.get(edge.to.nodeId)
    if (fromId === undefined || toId === undefined) return []
    return [
      {
        id: options.createEdgeId(),
        from: { ...edge.from, nodeId: fromId },
        to: { ...edge.to, nodeId: toId },
      },
    ]
  })

  return {
    graph: {
      ...graph,
      nodes: { ...graph.nodes, ...Object.fromEntries(pastedNodes.map((node) => [node.id, node])) },
      edges: { ...graph.edges, ...Object.fromEntries(pastedEdges.map((edge) => [edge.id, edge])) },
    },
    pastedNodeIds: pastedNodes.map((node) => node.id),
  }
}
