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

export interface InlineValueDiff {
  /** Values that changed (or appeared) on unconnected inputs: each fits a uniform in place. */
  readonly changes: readonly InlineValueChange[]
  /** Nodes that lost an inline value, which no uniform can represent: their readers rebuild. */
  readonly nodesWithRemovedValues: ReadonlySet<NodeId>
}

/**
 * Splits what changed between two graphs of the same topology into values that fit a uniform in
 * place and nodes that lost a value. A connected input's inline value is ignored by the compiler,
 * so changing it needs no uniform.
 */
export function partitionInlineValues(previous: Graph, next: Graph): InlineValueDiff {
  const connected = connectedInputKeys(next)
  const changes: InlineValueChange[] = []
  const nodesWithRemovedValues = new Set<NodeId>()

  for (const node of Object.values(next.nodes)) {
    const previousValues = previous.nodes[node.id]?.inputValues ?? {}
    if (Object.keys(previousValues).some((portId) => !(portId in node.inputValues))) {
      nodesWithRemovedValues.add(node.id)
    }
    for (const [portId, value] of Object.entries(node.inputValues)) {
      const ref: PortRef = { nodeId: node.id, portId }
      if (previousValues[portId] === value || connected.has(portKey(ref))) continue
      changes.push({ ref, value })
    }
  }
  return { changes, nodesWithRemovedValues }
}

/**
 * Inline values that differ between two graphs of the same topology, or `null` when a value
 * disappeared anywhere: the one material that reads the whole graph must then be built again.
 */
export function diffInlineValues(
  previous: Graph,
  next: Graph,
): readonly InlineValueChange[] | null {
  const { changes, nodesWithRemovedValues } = partitionInlineValues(previous, next)
  return nodesWithRemovedValues.size > 0 ? null : changes
}

/** Blackboard properties whose value differs between two graphs, matched by id. */
export function changedProperties(previous: Graph, next: Graph): readonly BlackboardProperty[] {
  return next.properties.filter((property) => {
    const before = previous.properties.find((candidate) => candidate.id === property.id)
    return before !== undefined && before.value !== property.value
  })
}
