import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, GraphNode } from '../types/graph'
import type { NodeId } from '../types/ids'
import { MASTER_NODE_ID, asNodeId } from '../types/ids'

/**
 * A Repeat zone is a pair of nodes, after Blender's: the Repeat Input takes the iteration count
 * and the starting value of each slot, the Repeat Output takes each slot's next value, and the
 * nodes between them (the body) run once per pass. The Repeat Output names its Repeat Input
 * through this hidden param, so the pair stays together when the graph between them changes.
 */
export const REPEAT_INPUT_PARAM = 'repeatInput'

/** The Repeat Input's count of passes. */
export const REPEAT_ITERATIONS_INPUT = 'iterations'

/** The Repeat Input's output holding the number of the current pass: 0, 1, 2… */
export const REPEAT_INDEX_OUTPUT = 'index'

/**
 * The values a zone carries from one pass to the next. Each is a port id on both nodes: the
 * Repeat Input's starting value (input) and current value (output), the Repeat Output's next
 * value (input) and value after the last pass (output).
 */
export const REPEAT_SLOTS = ['a', 'b', 'c', 'd'] as const
export type RepeatSlot = (typeof REPEAT_SLOTS)[number]

/** The most passes a zone makes, so a runaway count cannot hang the GPU. */
export const REPEAT_MAX_ITERATIONS = 1024

/** A Repeat Output and the Repeat Input it names, as stored: either may be missing or wrong. */
export interface RepeatLink {
  readonly input: NodeId
  readonly output: NodeId
}

/**
 * Every pairing the graph stores: a node carrying `repeatInput` that names another node of the
 * graph, never the master nor a node that names a Repeat Input itself.
 * Needs no registry, so the topological order and the cycle check can treat each pair as an edge
 * from the Repeat Input to the Repeat Output: the Output reads what the Input starts with.
 */
export function repeatLinks(graph: Graph): readonly RepeatLink[] {
  return Object.values(graph.nodes).flatMap((node): RepeatLink[] => {
    const inputId = node.params[REPEAT_INPUT_PARAM]
    const input = typeof inputId === 'string' ? graph.nodes[asNodeId(inputId)] : undefined
    // A hand-edited reference may name anything: only a node that could be a Repeat Input counts.
    const isCandidate =
      input !== undefined &&
      input.id !== node.id &&
      input.id !== MASTER_NODE_ID &&
      input.params[REPEAT_INPUT_PARAM] === undefined
    return isCandidate ? [{ input: input.id, output: node.id }] : []
  })
}

/** The other node of a stored pair, in either direction; null when the node is in none. */
export function repeatPartnerOf(graph: Graph, nodeId: NodeId): NodeId | null {
  const link = repeatLinks(graph).find(({ input, output }) => input === nodeId || output === nodeId)
  if (link === undefined) return null
  return link.input === nodeId ? link.output : link.input
}

/** The given ids plus the other node of every Repeat zone among them: a zone goes as a whole. */
export function withRepeatPartners(graph: Graph, ids: readonly NodeId[]): readonly NodeId[] {
  const all = new Set(ids)
  for (const { input, output } of repeatLinks(graph)) {
    if (all.has(input)) all.add(output)
    if (all.has(output)) all.add(input)
  }
  return [...all]
}

export type RepeatPairing =
  | { readonly ok: true; readonly input: GraphNode }
  | { readonly ok: false; readonly message: string }

/**
 * The Repeat Input a Repeat Output runs with: the node its param names, which must be a Repeat
 * Input that no other Repeat Output names.
 */
export function findRepeatInput(
  graph: Graph,
  registry: NodeRegistry,
  output: GraphNode,
): RepeatPairing {
  const inputId = output.params[REPEAT_INPUT_PARAM]
  const input = typeof inputId === 'string' ? graph.nodes[asNodeId(inputId)] : undefined
  if (input === undefined || registry.get(input.type)?.repeat !== 'input') {
    return { ok: false, message: 'This Repeat Output has no Repeat Input' }
  }
  const claimed = repeatLinks(graph).some(
    (link) => link.input === input.id && link.output !== output.id,
  )
  if (claimed) {
    return { ok: false, message: 'Another Repeat Output already uses this Repeat Input' }
  }
  return { ok: true, input }
}

/** Every link, real edges and zone pairs alike, as source to consumers and consumer to sources. */
export interface DependencyIndex {
  readonly consumers: ReadonlyMap<NodeId, readonly NodeId[]>
  readonly sources: ReadonlyMap<NodeId, readonly NodeId[]>
}

export function indexDependencies(graph: Graph): DependencyIndex {
  const consumers = new Map<NodeId, NodeId[]>()
  const sources = new Map<NodeId, NodeId[]>()
  const link = (from: NodeId, to: NodeId): void => {
    consumers.set(from, [...(consumers.get(from) ?? []), to])
    sources.set(to, [...(sources.get(to) ?? []), from])
  }
  for (const edge of Object.values(graph.edges)) link(edge.from.nodeId, edge.to.nodeId)
  for (const { input, output } of repeatLinks(graph)) link(input, output)
  return { consumers, sources }
}

function reachable(
  start: NodeId,
  next: ReadonlyMap<NodeId, readonly NodeId[]>,
): ReadonlySet<NodeId> {
  const visited = new Set<NodeId>()
  const pending = [...(next.get(start) ?? [])]
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (visited.has(id)) continue
    visited.add(id)
    pending.push(...(next.get(id) ?? []))
  }
  return visited
}

/**
 * The body of a zone: the nodes that read the Repeat Input (directly or not) and feed the Repeat
 * Output. They change from pass to pass, so they are built inside the loop; everything else the
 * body reads is computed once, before it.
 */
export function repeatZoneBody(
  dependencies: DependencyIndex,
  input: NodeId,
  output: NodeId,
): ReadonlySet<NodeId> {
  const downstream = reachable(input, dependencies.consumers)
  const upstream = reachable(output, dependencies.sources)
  const body = new Set([...downstream].filter((id) => upstream.has(id)))
  body.delete(input)
  body.delete(output)
  return body
}
