import type { Graph, GraphNode, XY } from '../types/graph'
import type { NodeId } from '../types/ids'

/** Updates positions of existing nodes; ids that are not in the graph are ignored. */
export function moveNodes(graph: Graph, positions: Readonly<Partial<Record<NodeId, XY>>>): Graph {
  const movedNodes = Object.values(graph.nodes).map((node): GraphNode => {
    const position = positions[node.id]
    return position === undefined ? node : { ...node, position }
  })
  return { ...graph, nodes: Object.fromEntries(movedNodes.map((node) => [node.id, node])) }
}
