import { sortedById } from '../serialization/stable-json'
import type { Graph } from '../types/graph'
import type { NodeId } from '../types/ids'
import { MASTER_NODE_ID } from '../types/ids'
import { FRAGMENT_KIND, FRAGMENT_SCHEMA_VERSION } from './graph-fragment'
import type { GraphFragment } from './graph-fragment'

/**
 * Copies the given nodes and the edges between them. The master node, unknown ids and edges that
 * leave the set are dropped. Returns null when nothing copyable remains.
 */
export function extractFragment(graph: Graph, nodeIds: readonly NodeId[]): GraphFragment | null {
  const selected = new Set(nodeIds.filter((id) => id !== MASTER_NODE_ID))
  const nodes = sortedById(Object.values(graph.nodes).filter((node) => selected.has(node.id)))
  if (nodes.length === 0) return null

  const copiedIds = new Set(nodes.map((node) => node.id))
  const edges = sortedById(
    Object.values(graph.edges).filter(
      (edge) => copiedIds.has(edge.from.nodeId) && copiedIds.has(edge.to.nodeId),
    ),
  )
  return { kind: FRAGMENT_KIND, schemaVersion: FRAGMENT_SCHEMA_VERSION, nodes, edges }
}
