import type { EdgeId, Graph, GraphEdge, NodeId } from '@nudo-tsl/core'

/** The nodes and edges that feed the selection or that the selection feeds, all the way. */
export interface SelectionChain {
  readonly nodeIds: ReadonlySet<NodeId>
  readonly edgeIds: ReadonlySet<EdgeId>
}

/** Set on canvas nodes and edges outside the chain (see graph-canvas.css). */
export const CHAIN_DIMMED_CLASS = 'chain-dimmed'
/** Set on the chain's edges. */
export const CHAIN_EMPHASIZED_CLASS = 'chain-emphasized'

type EdgeEnd = 'from' | 'to'

function edgesBy(graph: Graph, end: EdgeEnd): ReadonlyMap<NodeId, readonly GraphEdge[]> {
  const byNode = new Map<NodeId, GraphEdge[]>()
  for (const edge of Object.values(graph.edges)) {
    const nodeId = edge[end].nodeId
    byNode.set(nodeId, [...(byNode.get(nodeId) ?? []), edge])
  }
  return byNode
}

/**
 * Walks from the seeds along edges in one direction only: upstream follows what feeds a node,
 * downstream what it feeds. Adds every node and edge it meets.
 */
function walk(
  seeds: readonly NodeId[],
  edgesOf: ReadonlyMap<NodeId, readonly GraphEdge[]>,
  next: EdgeEnd,
  nodeIds: Set<NodeId>,
  edgeIds: Set<EdgeId>,
): void {
  const visited = new Set<NodeId>()
  const pending = [...seeds]
  for (let nodeId = pending.pop(); nodeId !== undefined; nodeId = pending.pop()) {
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    nodeIds.add(nodeId)
    for (const edge of edgesOf.get(nodeId) ?? []) {
      edgeIds.add(edge.id)
      pending.push(edge[next].nodeId)
    }
  }
}

/**
 * The chain of the selected nodes: everything upstream and downstream of them. Null when there is
 * nothing to highlight: no selection, or a selection without a single connection.
 */
export function selectionChain(graph: Graph, selected: readonly NodeId[]): SelectionChain | null {
  const seeds = selected.filter((nodeId) => graph.nodes[nodeId] !== undefined)
  const nodeIds = new Set<NodeId>()
  const edgeIds = new Set<EdgeId>()
  walk(seeds, edgesBy(graph, 'to'), 'from', nodeIds, edgeIds)
  walk(seeds, edgesBy(graph, 'from'), 'to', nodeIds, edgeIds)
  return edgeIds.size === 0 ? null : { nodeIds, edgeIds }
}

/** The class a canvas node or edge wears while the chain is highlighted; none without a chain. */
export function chainClassOf(
  chain: SelectionChain | null,
  kind: 'node' | 'edge',
  id: string,
): string | undefined {
  if (chain === null) return undefined
  const ids: ReadonlySet<string> = kind === 'node' ? chain.nodeIds : chain.edgeIds
  if (!ids.has(id)) return CHAIN_DIMMED_CLASS
  return kind === 'edge' ? CHAIN_EMPHASIZED_CLASS : undefined
}
