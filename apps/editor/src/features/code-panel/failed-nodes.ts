import type { CompileError, Graph, NodeId, NodeRegistry } from '@nudo-tsl/core'

import { nodeTitle } from '@/features/canvas/to-flow'

/** A node that keeps the module from generating, named as its header names it. */
export interface FailedNode {
  readonly nodeId: NodeId
  readonly title: string
}

/**
 * Each node the errors name, once, in the order first named, titled from `nodeRegistry` (the UI
 * language). A node deleted since the module was generated is left out.
 */
export function failedNodesOf(
  errors: readonly CompileError[],
  graph: Graph,
  nodeRegistry: NodeRegistry,
): readonly FailedNode[] {
  const nodeIds = [...new Set(errors.map((error) => error.nodeId))]
  return nodeIds.flatMap((nodeId) => {
    const node = graph.nodes[nodeId]
    if (node === undefined) return []
    const definition = nodeRegistry.get(node.type)
    const title =
      definition === undefined ? node.type : nodeTitle(node, definition, graph.properties)
    return [{ nodeId, title }]
  })
}
