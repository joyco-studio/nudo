import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, GraphEdge, GraphNode, XY } from '../types/graph'
import type { EdgeId, NodeId } from '../types/ids'
import { MASTER_NODE_ID, MASTER_NODE_TYPE, asNodeId } from '../types/ids'
import { PROPERTY_ID_PARAM } from '../types/param-definition'
import { REPEAT_INPUT_PARAM } from '../repeat/repeat-zone'
import type { GraphFragment } from './graph-fragment'

export interface PasteOptions {
  readonly offset: XY
  /** Must return an id that is not used in the graph; called once per pasted node. */
  createNodeId: () => NodeId
  /** Must return an id that is not used in the graph; called once per pasted edge. */
  createEdgeId: () => EdgeId
  /**
   * Identifies property readers by their definition (`reads: 'property'`). Without it, any node
   * carrying a `propertyId` param counts as a reader.
   */
  registry?: NodeRegistry
}

export interface PasteResult {
  readonly graph: Graph
  readonly pastedNodeIds: readonly NodeId[]
  /** Fragment ids of the property readers skipped because their property is not in the graph. */
  readonly droppedNodeIds: readonly NodeId[]
}

/** Whether the node reads a Blackboard property that the target graph does not have. */
function isDanglingReader(
  graph: Graph,
  node: GraphNode,
  registry: NodeRegistry | undefined,
): boolean {
  const isReader =
    registry === undefined
      ? PROPERTY_ID_PARAM in node.params
      : registry.get(node.type)?.reads === 'property'
  if (!isReader) return false
  const propertyId = node.params[PROPERTY_ID_PARAM]
  return !graph.properties.some((property) => property.id === propertyId)
}

/**
 * Adds a copy of the fragment with fresh ids, moved by `offset`. The fragment was validated by
 * `parseFragment` (known types, edges inside the set), so only property references are re-checked:
 * readers of properties the target graph lacks are skipped together with their edges.
 */
export function pasteFragment(
  graph: Graph,
  fragment: GraphFragment,
  options: PasteOptions,
): PasteResult {
  const nonMasterNodes = fragment.nodes.filter(
    (node) => node.id !== MASTER_NODE_ID && node.type !== MASTER_NODE_TYPE,
  )
  const droppedNodes = nonMasterNodes.filter((node) =>
    isDanglingReader(graph, node, options.registry),
  )
  const copyableNodes = nonMasterNodes.filter((node) => !droppedNodes.includes(node))
  const newIdByOldId = new Map<NodeId, NodeId>(
    copyableNodes.map((node) => [node.id, options.createNodeId()]),
  )

  /** A pasted Repeat Output pairs with the copy of its Repeat Input, or with none. */
  const pairedParams = (node: GraphNode): GraphNode['params'] => {
    const partner = node.params[REPEAT_INPUT_PARAM]
    if (typeof partner !== 'string') return node.params
    const copy = newIdByOldId.get(asNodeId(partner))
    if (copy !== undefined) return { ...node.params, [REPEAT_INPUT_PARAM]: copy }
    return Object.fromEntries(
      Object.entries(node.params).filter(([paramId]) => paramId !== REPEAT_INPUT_PARAM),
    )
  }

  const pastedNodes = copyableNodes.flatMap((node): GraphNode[] => {
    const id = newIdByOldId.get(node.id)
    if (id === undefined) return []
    const position = {
      x: node.position.x + options.offset.x,
      y: node.position.y + options.offset.y,
    }
    return [{ ...node, id, position, params: pairedParams(node) }]
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
    droppedNodeIds: droppedNodes.map((node) => node.id),
  }
}
