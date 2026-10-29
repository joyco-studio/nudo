import { err, float, ok, setInputValue, setParam, vec3 } from '@nudo-tsl/core'
import type {
  Graph,
  GraphEdge,
  GraphNode,
  NodeId,
  NodeRegistry,
  PortValue,
  Result,
} from '@nudo-tsl/core'
import { colorRampStopInputIds } from '@nudo-tsl/nodes'

import {
  COLOR_RAMP_MAX_STOPS,
  COLOR_RAMP_MIN_STOPS,
  colorRampColorAt,
  colorRampInterpolation,
  isColorRamp,
  readColorRampStops,
  stopPortOf,
} from './color-ramp-stops'
import type { ColorRampStop, StopPart } from './color-ramp-stops'

/** Why a Color Ramp edit was refused. The editor disables the controls that would cause these. */
export type ColorRampError =
  | 'node-not-found'
  | 'not-a-color-ramp'
  | 'too-many-stops'
  | 'too-few-stops'
  | 'stop-out-of-range'
  | 'rejected-by-graph'

type ColorRampResult = Result<Graph, ColorRampError>

const COUNT_PARAM = 'count'

interface RampContext {
  readonly node: GraphNode
  readonly stops: readonly ColorRampStop[]
}

function rampContext(
  graph: Graph,
  registry: NodeRegistry,
  nodeId: NodeId,
): Result<RampContext, ColorRampError> {
  const node = graph.nodes[nodeId]
  if (node === undefined) return err('node-not-found')
  if (!isColorRamp(node)) return err('not-a-color-ramp')
  return ok({ node, stops: readColorRampStops(node, registry) })
}

const isInPlay = (stops: readonly ColorRampStop[], index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < stops.length

/**
 * Writes `stops` into the first slots and forgets the stored values of the slots that drop out of
 * play (from `stops.length` up to `previousCount`).
 */
function withStopValues(
  node: GraphNode,
  stops: readonly ColorRampStop[],
  previousCount: number,
): GraphNode {
  const droppedIds = new Set<string>()
  for (let index = stops.length; index < previousCount; index += 1) {
    const ids = colorRampStopInputIds(index)
    droppedIds.add(ids.position)
    droppedIds.add(ids.color)
  }
  const kept = Object.entries(node.inputValues).filter(([inputId]) => !droppedIds.has(inputId))
  const written = stops.flatMap((stop, index): [string, PortValue][] => {
    const ids = colorRampStopInputIds(index)
    return [
      [ids.position, float(stop.position)],
      [ids.color, vec3(...stop.color)],
    ]
  })
  return { ...node, inputValues: Object.fromEntries([...kept, ...written]) }
}

const ALL_PARTS: readonly StopPart[] = ['position', 'color']

const edgesById = (edges: readonly GraphEdge[]): Graph['edges'] =>
  Object.fromEntries(edges.map((edge) => [edge.id, edge]))

/**
 * Moves the edges that feed the ramp's stops in play (the first `count`; only the given parts):
 * each goes to the stop `newIndexOf` gives for its current one, or is removed when that is null.
 * Edges on stops beyond the count (only a hand-made file has them) stay where they are. Edge ids
 * are kept; other edges stay as they are.
 */
function withStopEdges(
  graph: Graph,
  nodeId: NodeId,
  count: number,
  newIndexOf: (index: number) => number | null,
  parts: readonly StopPart[] = ALL_PARTS,
): Graph {
  const edges = Object.values(graph.edges).flatMap((edge): GraphEdge[] => {
    const port = edge.to.nodeId === nodeId ? stopPortOf(edge.to.portId) : null
    if (port === null || port.index >= count || !parts.includes(port.part)) return [edge]
    const newIndex = newIndexOf(port.index)
    if (newIndex === null) return []
    const portId = colorRampStopInputIds(newIndex)[port.part]
    return [{ ...edge, to: { nodeId, portId } }]
  })
  return { ...graph, edges: edgesById(edges) }
}

/** Removes the edges that feed stop `index` of the ramp. */
function withoutStopEdges(graph: Graph, nodeId: NodeId, index: number): Graph {
  const feedsStop = (edge: GraphEdge): boolean =>
    edge.to.nodeId === nodeId && stopPortOf(edge.to.portId)?.index === index
  return {
    ...graph,
    edges: edgesById(Object.values(graph.edges).filter((edge) => !feedsStop(edge))),
  }
}

/** Replaces the node's stops and sets the new count, as one graph. */
function withStops(
  graph: Graph,
  registry: NodeRegistry,
  context: RampContext,
  stops: readonly ColorRampStop[],
): ColorRampResult {
  const node = withStopValues(context.node, stops, context.stops.length)
  const withValues = { ...graph, nodes: { ...graph.nodes, [node.id]: node } }
  const counted = setParam(
    withValues,
    registry,
    { nodeId: node.id, paramId: COUNT_PARAM },
    stops.length,
  )
  return counted.ok ? ok(counted.value) : err('rejected-by-graph')
}

/** Where `addStop` puts the new stop: after the widest gap between two neighbouring stops. */
export function insertedStopIndex(stops: readonly ColorRampStop[]): number {
  let bestEnd = 1
  let bestWidth = -Infinity
  for (let index = 1; index < stops.length; index += 1) {
    const width = (stops[index]?.position ?? 0) - (stops[index - 1]?.position ?? 0)
    if (width > bestWidth) {
      bestWidth = width
      bestEnd = index
    }
  }
  return bestEnd
}

/**
 * Adds a stop in the middle of the widest gap, with the color the ramp already has there. The
 * stops after it (values and edges) move up one place.
 */
export function addStop(graph: Graph, registry: NodeRegistry, nodeId: NodeId): ColorRampResult {
  const context = rampContext(graph, registry, nodeId)
  if (!context.ok) return context
  const { node, stops } = context.value
  if (stops.length >= COLOR_RAMP_MAX_STOPS) return err('too-many-stops')

  const insertAt = insertedStopIndex(stops)
  const before = stops[insertAt - 1]
  const after = stops[insertAt]
  if (before === undefined || after === undefined) return err('stop-out-of-range')
  const position = (before.position + after.position) / 2
  const inserted = {
    position,
    color: colorRampColorAt(stops, colorRampInterpolation(node), position),
  }

  const nextStops = [...stops.slice(0, insertAt), inserted, ...stops.slice(insertAt)]
  // The stop the higher count brings into play takes the last stop's place, wires included: a
  // stale edge left on it (only a hand-made file has one) would feed it twice.
  const cleared = withoutStopEdges(graph, nodeId, stops.length)
  const shifted = withStopEdges(cleared, nodeId, stops.length, (index) =>
    index >= insertAt ? index + 1 : index,
  )
  return withStops(shifted, registry, context.value, nextStops)
}

/**
 * Removes a stop with the edges that feed it. The stops after it (values and edges) move down one
 * place, so no edge is left on a stop the lower count hides. Refused at two stops.
 */
export function removeStop(
  graph: Graph,
  registry: NodeRegistry,
  nodeId: NodeId,
  index: number,
): ColorRampResult {
  const context = rampContext(graph, registry, nodeId)
  if (!context.ok) return context
  const { stops } = context.value
  if (!isInPlay(stops, index)) return err('stop-out-of-range')
  if (stops.length <= COLOR_RAMP_MIN_STOPS) return err('too-few-stops')

  const nextStops = stops.filter((_, stopIndex) => stopIndex !== index)
  const shifted = withStopEdges(graph, nodeId, stops.length, (stopIndex) => {
    if (stopIndex === index) return null
    return stopIndex > index ? stopIndex - 1 : stopIndex
  })
  return withStops(shifted, registry, context.value, nextStops)
}

/**
 * Sets a stop's position, held between its neighbours (and inside 0..1) so the positions keep
 * growing with the index, as the node expects. Only a uniform changes: no recompile.
 */
export function moveStop(
  graph: Graph,
  registry: NodeRegistry,
  nodeId: NodeId,
  index: number,
  position: number,
): ColorRampResult {
  const context = rampContext(graph, registry, nodeId)
  if (!context.ok) return context
  const { stops } = context.value
  if (!isInPlay(stops, index)) return err('stop-out-of-range')

  const { min, max } = stopPositionRange(stops, index)
  const clamped = Math.min(max, Math.max(min, position))
  const ref = { nodeId, portId: colorRampStopInputIds(index).position }
  const result = setInputValue(graph, ref, float(clamped))
  return result.ok ? ok(result.value) : err('rejected-by-graph')
}

/** Where a stop may go: between its neighbours, and never outside 0..1. */
export function stopPositionRange(
  stops: readonly ColorRampStop[],
  index: number,
): { readonly min: number; readonly max: number } {
  return {
    min: Math.max(0, stops[index - 1]?.position ?? 0),
    max: Math.min(1, stops[index + 1]?.position ?? 1),
  }
}

/**
 * Reorders two stops: they trade colors, with the wires that feed them, while the positions (and
 * their wires) stay where they are, so the positions keep growing with the index.
 */
export function swapStops(
  graph: Graph,
  registry: NodeRegistry,
  nodeId: NodeId,
  a: number,
  b: number,
): ColorRampResult {
  const context = rampContext(graph, registry, nodeId)
  if (!context.ok) return context
  const { node, stops } = context.value
  const stopA = stops[a]
  const stopB = stops[b]
  if (!isInPlay(stops, a) || !isInPlay(stops, b) || stopA === undefined || stopB === undefined) {
    return err('stop-out-of-range')
  }

  const inputValues = {
    ...node.inputValues,
    [colorRampStopInputIds(a).color]: vec3(...stopB.color),
    [colorRampStopInputIds(b).color]: vec3(...stopA.color),
  }
  const swapped = { ...graph, nodes: { ...graph.nodes, [nodeId]: { ...node, inputValues } } }
  const tradeIndex = (index: number): number => {
    if (index === a) return b
    return index === b ? a : index
  }
  return ok(withStopEdges(swapped, nodeId, stops.length, tradeIndex, ['color']))
}
