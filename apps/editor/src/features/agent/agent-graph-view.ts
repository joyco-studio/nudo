import { asNodeId, portKey, resolvePortTypes } from '@nudo-tsl/core'
import type {
  DataType,
  Graph,
  NodeId,
  NodeRegistry,
  ParamValue,
  PortRef,
  PortValue,
  PropertyType,
} from '@nudo-tsl/core'

export interface AgentInput {
  id: string
  type: DataType
  value?: PortValue
  connectedFrom?: PortRef
}

export interface AgentNode {
  id: NodeId
  type: string
  label: string
  position: { x: number; y: number }
  inputs: AgentInput[]
  params: Record<string, ParamValue>
}

export interface AgentGraph {
  nodes: AgentNode[]
  edges: { id: string; from: PortRef; to: PortRef }[]
  properties: {
    id: string
    name: string
    label: string
    type: PropertyType
    exposed: boolean
    value: PortValue
  }[]
  errors: { nodeId: NodeId; message: string }[]
}

const FALLBACK_TYPE: DataType = 'float'

/** The graph as the agent reads it: English labels, resolved port types, no editor internals. */
export function toAgentGraph(
  graph: Graph,
  errorsByNode: Readonly<Partial<Record<NodeId, string>>>,
  registry: NodeRegistry,
): AgentGraph {
  const types = resolvePortTypes(graph, registry)
  const sourceByInput = new Map<string, PortRef>(
    Object.values(graph.edges).map((edge) => [portKey(edge.to), edge.from]),
  )

  const nodes = Object.values(graph.nodes).map((node): AgentNode => {
    const definition = registry.get(node.type)
    const inputs = (definition?.inputs ?? []).map((input): AgentInput => {
      const ref = { nodeId: node.id, portId: input.id }
      const type = types.inputs.get(portKey(ref)) ?? FALLBACK_TYPE
      const source = sourceByInput.get(portKey(ref))
      if (source !== undefined) return { id: input.id, type, connectedFrom: source }
      return { id: input.id, type, value: node.inputValues[input.id] ?? input.default }
    })
    return {
      id: node.id,
      type: node.type,
      label: definition?.label ?? node.type,
      position: { x: node.position.x, y: node.position.y },
      inputs,
      params: { ...node.params },
    }
  })

  return {
    nodes,
    edges: Object.values(graph.edges).map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
    })),
    properties: graph.properties.map((property) => ({
      id: property.id,
      name: property.name,
      label: property.label,
      type: property.type,
      exposed: property.exposed,
      value: property.value,
    })),
    errors: Object.entries(errorsByNode).flatMap(([nodeId, message]) =>
      message === undefined ? [] : [{ nodeId: asNodeId(nodeId), message }],
    ),
  }
}
