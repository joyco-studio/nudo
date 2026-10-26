import { topologicalOrder } from '../graph/topological-order'
import type { NodeRegistry } from '../registry/node-registry'
import { widestType } from '../types-system/widest-type'
import type { DataType, PortTypeSpec, VectorType } from '../types/data-type'
import { VECTOR_TYPES } from '../types/data-type'
import type { Graph, GraphEdge, GraphNode } from '../types/graph'
import type { NodeId } from '../types/ids'
import type { AnyNodeDefinition } from '../types/node-definition'
import { portKey } from './port-key'
import type { PortKey } from './port-key'

export interface ResolvedTypes {
  readonly inputs: ReadonlyMap<PortKey, DataType>
  readonly outputs: ReadonlyMap<PortKey, DataType>
}

/** Used when a generic group has neither connected inputs nor inline vector values. */
const FALLBACK_GROUP_TYPE: VectorType = 'float'

const isVectorType = (type: DataType): type is VectorType =>
  VECTOR_TYPES.some((vectorType) => vectorType === type)

const toVectorTypes = (types: readonly (DataType | undefined)[]): readonly VectorType[] =>
  types.filter((type): type is VectorType => type !== undefined && isVectorType(type))

const groupOf = (spec: PortTypeSpec): string | null => (spec.kind === 'generic' ? spec.group : null)

/** Edges that feed the given node, grouped by the target input id. */
function indexIncomingEdges(graph: Graph): ReadonlyMap<NodeId, readonly GraphEdge[]> {
  const incoming = new Map<NodeId, GraphEdge[]>()
  for (const edge of Object.values(graph.edges)) {
    const edges = incoming.get(edge.to.nodeId) ?? []
    edges.push(edge)
    incoming.set(edge.to.nodeId, edges)
  }
  return incoming
}

function resolveGroupTypes(
  node: GraphNode,
  definition: AnyNodeDefinition,
  incomingEdges: readonly GraphEdge[],
  outputTypes: ReadonlyMap<PortKey, DataType>,
): ReadonlyMap<string, VectorType> {
  const connectedTypes = new Map<string, (DataType | undefined)[]>()
  const inlineTypes = new Map<string, (DataType | undefined)[]>()

  for (const input of definition.inputs) {
    const group = groupOf(input.type)
    if (group === null) continue

    const sources = incomingEdges.filter((edge) => edge.to.portId === input.id)
    if (sources.length > 0) {
      connectedTypes.set(group, [
        ...(connectedTypes.get(group) ?? []),
        ...sources.map((edge) => outputTypes.get(portKey(edge.from))),
      ])
      continue
    }

    const inlineValue = node.inputValues[input.id] ?? input.default
    inlineTypes.set(group, [...(inlineTypes.get(group) ?? []), inlineValue.type])
  }

  const groups = new Set([...connectedTypes.keys(), ...inlineTypes.keys()])
  return new Map(
    [...groups].map((group) => {
      const connected = widestType(toVectorTypes(connectedTypes.get(group) ?? []))
      const inline = widestType(toVectorTypes(inlineTypes.get(group) ?? []))
      return [group, connected ?? inline ?? FALLBACK_GROUP_TYPE]
    }),
  )
}

const resolveSpec = (spec: PortTypeSpec, groupTypes: ReadonlyMap<string, VectorType>): DataType => {
  if (spec.kind === 'concrete') return spec.type
  return groupTypes.get(spec.group) ?? FALLBACK_GROUP_TYPE
}

/**
 * Resolves every input and output port to a concrete type.
 * A generic group takes the widest type among its connected sources; when nothing is
 * connected it falls back to the widest inline value (so disconnecting reverts to the default).
 */
export function resolvePortTypes(graph: Graph, registry: NodeRegistry): ResolvedTypes {
  const inputs = new Map<PortKey, DataType>()
  const outputs = new Map<PortKey, DataType>()
  const incomingByNode = indexIncomingEdges(graph)

  for (const nodeId of topologicalOrder(graph)) {
    const node = graph.nodes[nodeId]
    const definition = node && registry.get(node.type)
    if (!node || !definition) continue

    const groupTypes = resolveGroupTypes(
      node,
      definition,
      incomingByNode.get(nodeId) ?? [],
      outputs,
    )

    for (const input of definition.inputs) {
      inputs.set(portKey({ nodeId, portId: input.id }), resolveSpec(input.type, groupTypes))
    }
    for (const output of definition.outputs) {
      outputs.set(portKey({ nodeId, portId: output.id }), resolveSpec(output.type, groupTypes))
    }
  }

  return { inputs, outputs }
}
