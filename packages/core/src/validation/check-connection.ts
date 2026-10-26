import type { NodeRegistry } from '../registry/node-registry'
import { portKey } from '../type-inference/port-key'
import { resolvePortTypes } from '../type-inference/resolve-port-types'
import { getConversion } from '../types-system/conversion'
import type { Conversion } from '../types-system/conversion'
import type { PortTypeSpec } from '../types/data-type'
import type { Graph, PortRef } from '../types/graph'
import { wouldCreateCycle } from './would-create-cycle'

export type ConnectionRejection = 'type-mismatch' | 'cycle' | 'same-node' | 'unknown-port'

export type ConnectionCheck =
  { ok: true; conversion: Conversion | null } | { ok: false; reason: ConnectionRejection }

const reject = (reason: ConnectionRejection): ConnectionCheck => ({ ok: false, reason })

/** The graph as it would be once any edge already feeding `to` has been replaced. */
function withoutEdgesInto(graph: Graph, to: PortRef): Graph {
  const keptEdges = Object.values(graph.edges).filter(
    (edge) => !(edge.to.nodeId === to.nodeId && edge.to.portId === to.portId),
  )
  return { ...graph, edges: Object.fromEntries(keptEdges.map((edge) => [edge.id, edge])) }
}

function findPortSpecs(
  graph: Graph,
  registry: NodeRegistry,
  from: PortRef,
  to: PortRef,
): { output: PortTypeSpec; input: PortTypeSpec } | null {
  const fromNode = graph.nodes[from.nodeId]
  const toNode = graph.nodes[to.nodeId]
  const fromDefinition = fromNode && registry.get(fromNode.type)
  const toDefinition = toNode && registry.get(toNode.type)
  const output = fromDefinition?.outputs.find((port) => port.id === from.portId)
  const input = toDefinition?.inputs.find((port) => port.id === to.portId)
  return output && input ? { output: output.type, input: input.type } : null
}

/** Whether an output can feed an input, and which implicit conversion that implies. */
export function checkConnection(
  graph: Graph,
  registry: NodeRegistry,
  from: PortRef,
  to: PortRef,
): ConnectionCheck {
  if (from.nodeId === to.nodeId) return reject('same-node')

  const specs = findPortSpecs(graph, registry, from, to)
  if (!specs) return reject('unknown-port')

  if (wouldCreateCycle(withoutEdgesInto(graph, to), from, to)) return reject('cycle')

  const sourceType = resolvePortTypes(graph, registry).outputs.get(portKey(from))
  if (sourceType === undefined) return reject('unknown-port')

  if (specs.input.kind === 'generic') {
    // Generic inputs adapt to their sources, so the conversion is decided at compile time.
    const accepted = specs.input.allowed.some((allowedType) => allowedType === sourceType)
    return accepted ? { ok: true, conversion: null } : reject('type-mismatch')
  }

  const conversion = getConversion(sourceType, specs.input.type)
  return conversion.ok ? { ok: true, conversion: conversion.conversion } : reject('type-mismatch')
}
