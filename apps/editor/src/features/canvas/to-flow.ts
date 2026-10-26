import { MASTER_NODE_ID, getConversion, portKey } from '@nudo-tsl/core'
import type {
  AnyNodeDefinition,
  Conversion,
  DataType,
  Graph,
  GraphEdge,
  GraphNode,
  NodeId,
  NodeRegistry,
  ResolvedTypes,
} from '@nudo-tsl/core'
import type { Edge, Node } from '@xyflow/react'
import type { CompileSlice, UiSlice } from '../../store/store-types'

export const GRAPH_NODE_TYPE = 'graph-node'
export const TYPED_EDGE_TYPE = 'typed'
const MASTER_TITLE = 'Master Stack'

export type FlowNodeData = {
  definition: AnyNodeDefinition
  node: GraphNode
  inputTypes: Record<string, DataType>
  outputTypes: Record<string, DataType>
  connectedInputs: ReadonlySet<string>
  connectedOutputs: ReadonlySet<string>
  error: string | undefined
}

export type FlowEdgeData = {
  /** Type of the output feeding the edge; it colors the stroke. */
  sourceType: DataType
  /** Implicit conversion applied where the edge enters its input, if any. */
  conversion: Conversion | null
}

export type FlowNode = Node<FlowNodeData, typeof GRAPH_NODE_TYPE>
export type FlowEdge = Edge<FlowEdgeData, typeof TYPED_EDGE_TYPE>

/** The name a node shows in its header and announces to assistive technology. */
export function nodeTitle(node: GraphNode, definition: AnyNodeDefinition): string {
  return node.id === MASTER_NODE_ID ? MASTER_TITLE : definition.label
}

/** Id of the visually hidden element that holds a node's description for `aria-describedby`. */
export function nodeDescriptionId(nodeId: NodeId): string {
  return `node-description-${nodeId}`
}

/** Ids of the ports with at least one edge, per node, on the side `end` of the edges. */
function connectedPortsByNode(
  graph: Graph,
  end: 'from' | 'to',
): ReadonlyMap<NodeId, ReadonlySet<string>> {
  const connected = new Map<NodeId, Set<string>>()
  for (const edge of Object.values(graph.edges)) {
    const { nodeId, portId } = edge[end]
    const ports = connected.get(nodeId) ?? new Set<string>()
    ports.add(portId)
    connected.set(nodeId, ports)
  }
  return connected
}

function portTypes(
  nodeId: NodeId,
  ports: readonly { readonly id: string }[],
  resolved: ReadonlyMap<string, DataType>,
): Record<string, DataType> {
  const types: Record<string, DataType> = {}
  for (const port of ports) {
    const type = resolved.get(portKey({ nodeId, portId: port.id }))
    if (type !== undefined) types[port.id] = type
  }
  return types
}

interface NodeEntry {
  readonly node: GraphNode
  readonly definition: AnyNodeDefinition
}

function portLabel(entry: NodeEntry, portId: string, side: 'inputs' | 'outputs'): string {
  const ports: readonly { readonly id: string; readonly label: string }[] = entry.definition[side]
  return ports.find((port) => port.id === portId)?.label ?? portId
}

function toFlowEdge(
  edge: GraphEdge,
  entries: ReadonlyMap<NodeId, NodeEntry>,
  types: ResolvedTypes,
): FlowEdge | null {
  const from = entries.get(edge.from.nodeId)
  const to = entries.get(edge.to.nodeId)
  const sourceType = types.outputs.get(portKey(edge.from))
  const targetType = types.inputs.get(portKey(edge.to))
  if (!from || !to || sourceType === undefined || targetType === undefined) return null

  const conversion = getConversion(sourceType, targetType)
  const fromName = `${nodeTitle(from.node, from.definition)} ${portLabel(from, edge.from.portId, 'outputs')}`
  const toName = `${nodeTitle(to.node, to.definition)} ${portLabel(to, edge.to.portId, 'inputs')}`
  return {
    id: edge.id,
    type: TYPED_EDGE_TYPE,
    source: edge.from.nodeId,
    sourceHandle: edge.from.portId,
    target: edge.to.nodeId,
    targetHandle: edge.to.portId,
    ariaLabel: `${fromName} to ${toName}`,
    data: { sourceType, conversion: conversion.ok ? conversion.conversion : null },
  }
}

/** Derives the React Flow view of the graph. Pure: the store stays the single source of truth. */
export function toFlow(
  graph: Graph,
  registry: NodeRegistry,
  types: ResolvedTypes,
  draft: UiSlice['draftPositions'],
  errors: CompileSlice['errorsByNode'],
  selected: readonly NodeId[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const selectedIds = new Set(selected)
  const connectedInputs = connectedPortsByNode(graph, 'to')
  const connectedOutputs = connectedPortsByNode(graph, 'from')
  const entries = new Map<NodeId, NodeEntry>()
  const nodes: FlowNode[] = []

  for (const node of Object.values(graph.nodes)) {
    const definition = registry.get(node.type)
    if (definition === undefined) continue
    entries.set(node.id, { node, definition })
    nodes.push({
      id: node.id,
      type: GRAPH_NODE_TYPE,
      position: draft[node.id] ?? node.position,
      selected: selectedIds.has(node.id),
      deletable: node.id !== MASTER_NODE_ID,
      ariaLabel: nodeTitle(node, definition),
      domAttributes: { 'aria-describedby': nodeDescriptionId(node.id) },
      data: {
        definition,
        node,
        inputTypes: portTypes(node.id, definition.inputs, types.inputs),
        outputTypes: portTypes(node.id, definition.outputs, types.outputs),
        connectedInputs: connectedInputs.get(node.id) ?? new Set<string>(),
        connectedOutputs: connectedOutputs.get(node.id) ?? new Set<string>(),
        error: errors[node.id],
      },
    })
  }

  const edges = Object.values(graph.edges)
    .map((edge) => toFlowEdge(edge, entries, types))
    .filter((edge): edge is FlowEdge => edge !== null)

  return { nodes, edges }
}
