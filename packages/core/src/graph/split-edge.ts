import type { NodeRegistry } from '../registry/node-registry'
import type { Graph } from '../types/graph'
import type { EdgeId } from '../types/ids'
import type { Result } from '../types/result'
import { err } from '../types/result'
import { addNode } from './add-node'
import type { AddNodeInput } from './add-node'
import { connect } from './connect'
import { disconnect } from './disconnect'
import type { GraphError } from './graph-error'

export interface SplitEdgeInput {
  readonly edgeId: EdgeId
  /** The node placed on the edge (a reroute). */
  readonly node: AddNodeInput
  /** Where the edge's value enters the new node. */
  readonly inputPortId: string
  /** Where the value leaves the new node for the edge's old target. */
  readonly outputPortId: string
  /** Ids of the two edges that replace the split one: into the node, then out of it. */
  readonly edgeIds: readonly [EdgeId, EdgeId]
}

/**
 * Adds a node in the middle of an edge: the edge's source feeds the node's input and the node's
 * output feeds the edge's old target. Fails, leaving the graph as it was, when either connection
 * is rejected.
 */
export function splitEdge(
  graph: Graph,
  registry: NodeRegistry,
  input: SplitEdgeInput,
): Result<Graph, GraphError> {
  const edge = graph.edges[input.edgeId]
  if (edge === undefined) return err({ code: 'edge-not-found', edgeId: input.edgeId })

  const withNode = addNode(disconnect(graph, [edge.id]), registry, input.node)
  if (!withNode.ok) return withNode
  const [intoNode, outOfNode] = input.edgeIds
  const fed = connect(withNode.value, registry, {
    id: intoNode,
    from: edge.from,
    to: { nodeId: input.node.id, portId: input.inputPortId },
  })
  if (!fed.ok) return fed
  return connect(fed.value, registry, {
    id: outOfNode,
    from: { nodeId: input.node.id, portId: input.outputPortId },
    to: edge.to,
  })
}
