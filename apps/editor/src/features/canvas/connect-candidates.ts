import { checkConnection, portKey, resolvePortTypes } from '@nudo-tsl/core'
import type {
  AnyNodeDefinition,
  DataType,
  EdgeId,
  Graph,
  GraphNode,
  NodeRegistry,
  PortRef,
  ResolvedTypes,
} from '@nudo-tsl/core'

import { nodeTitle } from './to-flow'

export type PortSide = 'input' | 'output'

/** The port a person started from. */
export interface ConnectOrigin {
  readonly side: PortSide
  readonly ref: PortRef
}

/** A port on another node that the origin can be connected to. */
export interface ConnectCandidate {
  readonly ref: PortRef
  /** "NodeLabel › PortLabel · type": what the list shows and what search matches. */
  readonly label: string
  readonly dataType: DataType
}

interface NodeEntry {
  readonly node: GraphNode
  readonly definition: AnyNodeDefinition
  readonly title: string
}

/** Node titles, numbered "Sine (1)", "Sine (2)" only where two nodes would read the same. */
function uniqueTitles(
  entries: readonly Omit<NodeEntry, 'title'>[],
  properties: Graph['properties'],
): readonly NodeEntry[] {
  const titles = entries.map((entry) => nodeTitle(entry.node, entry.definition, properties))
  const seen = new Map<string, number>()
  return entries.map((entry, index) => {
    const title = titles[index] ?? entry.definition.label
    const count = titles.filter((other) => other === title).length
    const position = (seen.get(title) ?? 0) + 1
    seen.set(title, position)
    return { ...entry, title: count > 1 ? `${title} (${String(position)})` : title }
  })
}

function nodeEntries(graph: Graph, registry: NodeRegistry): readonly NodeEntry[] {
  const known = Object.values(graph.nodes).flatMap((node) => {
    const definition = registry.get(node.type)
    return definition === undefined ? [] : [{ node, definition }]
  })
  return uniqueTitles(known, graph.properties)
}

function candidatesOf(
  entry: NodeEntry,
  side: PortSide,
  types: ResolvedTypes,
): readonly ConnectCandidate[] {
  const ports: readonly { readonly id: string; readonly label: string }[] =
    side === 'input' ? entry.definition.inputs : entry.definition.outputs
  const resolved = side === 'input' ? types.inputs : types.outputs
  return ports.flatMap((port) => {
    const ref: PortRef = { nodeId: entry.node.id, portId: port.id }
    const dataType = resolved.get(portKey(ref))
    if (dataType === undefined) return []
    return [{ ref, dataType, label: `${entry.title} › ${port.label} · ${dataType}` }]
  })
}

/**
 * Every port in the graph the origin could be connected to, checked with `checkConnection`. An
 * output lists inputs and an input lists outputs; ports on the origin's own node never appear.
 */
export function listConnectCandidates(
  graph: Graph,
  registry: NodeRegistry,
  origin: ConnectOrigin,
): readonly ConnectCandidate[] {
  const types = resolvePortTypes(graph, registry)
  const wantedSide: PortSide = origin.side === 'output' ? 'input' : 'output'

  return nodeEntries(graph, registry)
    .filter((entry) => entry.node.id !== origin.ref.nodeId)
    .flatMap((entry) => candidatesOf(entry, wantedSide, types))
    .filter((candidate) => {
      const [from, to] =
        origin.side === 'output' ? [origin.ref, candidate.ref] : [candidate.ref, origin.ref]
      return checkConnection(graph, registry, from, to, types).ok
    })
}

/** The edges attached to a port: at most one for an input, any number for an output. */
export function edgesAttachedTo(graph: Graph, origin: ConnectOrigin): readonly EdgeId[] {
  const end = origin.side === 'input' ? 'to' : 'from'
  return Object.values(graph.edges)
    .filter(
      (edge) => edge[end].nodeId === origin.ref.nodeId && edge[end].portId === origin.ref.portId,
    )
    .map((edge) => edge.id)
}
