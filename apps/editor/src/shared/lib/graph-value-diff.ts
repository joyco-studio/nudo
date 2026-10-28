import { portKey } from '@nudo-tsl/core'
import type { BlackboardProperty, Graph, NodeId, PortKey, PortRef, PortValue } from '@nudo-tsl/core'

/**
 * An inline value that changed between two graphs of the same topology. The Main Preview and the
 * node previews both push these into their materials' uniforms instead of compiling again.
 */
export interface InlineValueChange {
  ref: PortRef
  value: PortValue
}

function connectedInputKeys(graph: Graph): ReadonlySet<PortKey> {
  return new Set(Object.values(graph.edges).map((edge) => portKey(edge.to)))
}

/**
 * Inline values that differ between two graphs of the same topology, or `null` when a value
 * disappeared (no uniform can represent that). A connected input's inline value is ignored by the
 * compiler, so changing it needs no uniform.
 */
export function diffInlineValues(
  previous: Graph,
  next: Graph,
): readonly InlineValueChange[] | null {
  const connected = connectedInputKeys(next)
  const changes: InlineValueChange[] = []

  for (const node of Object.values(next.nodes)) {
    const previousValues = previous.nodes[node.id]?.inputValues ?? {}
    if (Object.keys(previousValues).some((portId) => !(portId in node.inputValues))) return null
    for (const [portId, value] of Object.entries(node.inputValues)) {
      const ref: PortRef = { nodeId: node.id, portId }
      if (previousValues[portId] === value || connected.has(portKey(ref))) continue
      changes.push({ ref, value })
    }
  }
  return changes
}

/**
 * The nodes that lost an inline value between two graphs: what `diffInlineValues` cannot express
 * in place, so whatever reads those nodes has to be built again.
 */
export function nodesWithRemovedValues(previous: Graph, next: Graph): ReadonlySet<NodeId> {
  const nodeIds = new Set<NodeId>()
  for (const node of Object.values(next.nodes)) {
    const previousValues = previous.nodes[node.id]?.inputValues ?? {}
    if (Object.keys(previousValues).some((portId) => !(portId in node.inputValues))) {
      nodeIds.add(node.id)
    }
  }
  return nodeIds
}

/** Blackboard properties whose value differs between two graphs, matched by id. */
export function changedProperties(previous: Graph, next: Graph): readonly BlackboardProperty[] {
  return next.properties.filter((property) => {
    const before = previous.properties.find((candidate) => candidate.id === property.id)
    return before !== undefined && before.value !== property.value
  })
}
