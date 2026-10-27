import type {
  AnyNodeDefinition,
  Graph,
  GraphNode,
  NodeId,
  NodeRegistry,
  PortRef,
} from '@nudo-tsl/core'

import { nodeTitle } from '@/features/canvas/to-flow'

/** What the Inspector shows for the current selection. */
export type InspectorSubject =
  | { readonly kind: 'node'; readonly node: GraphNode; readonly definition: AnyNodeDefinition }
  | { readonly kind: 'selection'; readonly count: number }
  | { readonly kind: 'graph' }

const GRAPH_SUBJECT: InspectorSubject = { kind: 'graph' }

/**
 * One selected node is inspected; several are summed up; nothing selected (or a selection that
 * points at a node that is gone) shows the graph settings.
 */
export function inspectorSubject(
  graph: Graph,
  registry: NodeRegistry,
  selectedNodeIds: readonly NodeId[],
): InspectorSubject {
  if (selectedNodeIds.length > 1) return { kind: 'selection', count: selectedNodeIds.length }
  const [onlyId] = selectedNodeIds
  const node = onlyId === undefined ? undefined : graph.nodes[onlyId]
  const definition = node === undefined ? undefined : registry.get(node.type)
  if (node === undefined || definition === undefined) return GRAPH_SUBJECT
  return { kind: 'node', node, definition }
}

/** The title of the node feeding an input, or null while nothing is connected to it. */
export function connectedSourceTitle(
  graph: Graph,
  registry: NodeRegistry,
  input: PortRef,
): string | null {
  const edge = Object.values(graph.edges).find(
    (candidate) => candidate.to.nodeId === input.nodeId && candidate.to.portId === input.portId,
  )
  const source = edge === undefined ? undefined : graph.nodes[edge.from.nodeId]
  const definition = source === undefined ? undefined : registry.get(source.type)
  if (source === undefined || definition === undefined) return null
  return nodeTitle(source, definition, graph.properties)
}
