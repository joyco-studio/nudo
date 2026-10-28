import {
  MASTER_NODE_ID,
  addNode,
  addProperty,
  addPropertyNode,
  asEdgeId,
  asNodeId,
  asPropertyId,
  connect,
  createGraph,
  setInputValue,
  setParam,
} from '@nudo-tsl/core'
import type {
  Graph,
  NodeId,
  NodeRegistry,
  ParamValue,
  PortRef,
  PortValue,
  Result,
} from '@nudo-tsl/core'

import type { ExampleSpec, NodeSpec, PortPath, PropertySpec, WireSpec } from './example-spec'

const ORIGIN = { x: 0, y: 0 }

/** The graph the spec describes; a failing operation is a mistake in the spec, so it throws. */
function expectOk<T, E>(result: Result<T, E>, what: string): T {
  if (!result.ok) throw new Error(`${what}: ${JSON.stringify(result.error)}`)
  return result.value
}

export function portRef(path: PortPath): PortRef {
  const separator = path.indexOf('.')
  return { nodeId: asNodeId(path.slice(0, separator)), portId: path.slice(separator + 1) }
}

/** A readable id that says what the wire joins: `noise.out-remap.in`. */
export const wireId = ([from, to]: WireSpec): string => `${from}-${to}`

function withProperty(graph: Graph, property: PropertySpec): Graph {
  return expectOk(
    addProperty(graph, {
      id: asPropertyId(property.name),
      label: property.label,
      name: property.name,
      exposed: true,
      type: property.value.type,
      ...(property.widget === undefined ? {} : { widget: property.widget }),
      value: property.value,
    }),
    `property ${property.name}`,
  )
}

function withValues(
  graph: Graph,
  nodeId: NodeId,
  inputs: Readonly<Record<string, PortValue>>,
): Graph {
  return Object.entries(inputs).reduce(
    (current, [portId, value]) =>
      expectOk(setInputValue(current, { nodeId, portId }, value), `${nodeId}.${portId}`),
    graph,
  )
}

function withParams(
  graph: Graph,
  registry: NodeRegistry,
  nodeId: NodeId,
  params: Readonly<Record<string, ParamValue>>,
): Graph {
  return Object.entries(params).reduce(
    (current, [paramId, value]) =>
      expectOk(setParam(current, registry, { nodeId, paramId }, value), `${nodeId} ${paramId}`),
    graph,
  )
}

function withNode(graph: Graph, registry: NodeRegistry, spec: NodeSpec): Graph {
  const id = asNodeId(spec.id)
  if (spec.kind === 'reader') {
    const input = { id, propertyId: asPropertyId(spec.property), position: ORIGIN }
    return expectOk(addPropertyNode(graph, registry, input), `reader ${spec.id}`)
  }
  const added = expectOk(
    addNode(graph, registry, { id, type: spec.type, position: ORIGIN }),
    spec.id,
  )
  return withParams(withValues(added, id, spec.inputs), registry, id, spec.params)
}

function withWire(graph: Graph, registry: NodeRegistry, wire: WireSpec): Graph {
  const [from, to] = wire
  const input = { id: asEdgeId(wireId(wire)), from: portRef(from), to: portRef(to) }
  return expectOk(connect(graph, registry, input), `wire ${wireId(wire)}`)
}

/**
 * Builds the spec's graph with core operations, every node at the origin: properties, nodes
 * (inline values and params set), the master's values and params, then the wires.
 */
export function assembleGraph(spec: ExampleSpec, registry: NodeRegistry): Graph {
  const withProperties = spec.properties.reduce(withProperty, createGraph())
  const withNodes = spec.groups
    .flatMap((group) => group.nodes)
    .reduce((graph, nodeSpec) => withNode(graph, registry, nodeSpec), withProperties)
  const withMaster = withParams(
    withValues(withNodes, MASTER_NODE_ID, spec.master.inputs ?? {}),
    registry,
    MASTER_NODE_ID,
    spec.master.params ?? {},
  )
  return spec.wires.reduce((graph, wire) => withWire(graph, registry, wire), withMaster)
}
