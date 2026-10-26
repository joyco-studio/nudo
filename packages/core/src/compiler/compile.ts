import type { NodeRegistry } from '../registry/node-registry'
import { portKey } from '../type-inference/port-key'
import type { PortKey } from '../type-inference/port-key'
import { resolvePortTypes } from '../type-inference/resolve-port-types'
import { getConversion } from '../types-system/conversion'
import type { DataType } from '../types/data-type'
import type { BlackboardProperty } from '../types/blackboard-property'
import type { Graph, GraphEdge, GraphNode, PortRef } from '../types/graph'
import type { NodeId, PropertyId } from '../types/ids'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'
import type { AnyNodeDefinition, InputDefinition } from '../types/node-definition'
import { PROPERTY_ID_PARAM } from '../types/param-definition'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { convertValue } from '../values/convert-value'
import { applyConversion } from './apply-conversion'
import { MASTER_SLOTS } from './compile-backend'
import { resolveParams } from './resolve-params'
import type {
  CompileBackend,
  CompileError,
  CompileResult,
  CompileTarget,
  MasterSlot,
} from './compile-backend'

/** The failure itself is already recorded in the shared error list. */
type Outcome<T> = Result<T, 'failed'>

type NodeOutputs<E> = Readonly<Record<string, E>>

const failed = err('failed' as const)

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Compiles the graph into backend expressions. Only nodes reachable from the target are
 * evaluated, each exactly once; errors from every reachable node are collected.
 */
export function compile<E>(
  graph: Graph,
  registry: NodeRegistry,
  backend: CompileBackend<E>,
  target: CompileTarget,
): CompileResult<E> {
  const { tsl } = backend
  const resolved = resolvePortTypes(graph, registry)
  const errors: CompileError[] = []
  const evaluated = new Map<NodeId, Outcome<NodeOutputs<E>>>()

  const propertyExpressions = new Map<PropertyId, E>()

  const incomingByInput = new Map<PortKey, GraphEdge>(
    Object.values(graph.edges).map((edge) => [portKey(edge.to), edge]),
  )

  const fail = (nodeId: NodeId, code: CompileError['code'], message: string): Outcome<never> => {
    errors.push({ nodeId, code, message })
    return failed
  }

  const resolveConnected = (ref: PortRef, edge: GraphEdge, inputType: DataType): Outcome<E> => {
    const source = evaluateNode(edge.from.nodeId)
    if (!source.ok) return failed
    const expression = source.value[edge.from.portId]
    const sourceType = resolved.outputs.get(portKey(edge.from))
    if (expression === undefined || sourceType === undefined) {
      return fail(ref.nodeId, 'unresolved-type', `Output ${portKey(edge.from)} has no expression`)
    }
    const conversion = getConversion(sourceType, inputType)
    if (!conversion.ok) {
      return fail(
        ref.nodeId,
        'unresolved-type',
        `Cannot convert ${sourceType} to ${inputType} at ${portKey(ref)}`,
      )
    }
    if (conversion.conversion === null) return ok(expression)
    try {
      return ok(applyConversion(tsl, expression, conversion.conversion))
    } catch (error) {
      return fail(ref.nodeId, 'unresolved-type', describeError(error))
    }
  }

  const resolveInline = (
    node: GraphNode,
    input: InputDefinition<string>,
    ref: PortRef,
    inputType: DataType,
  ): Outcome<E> => {
    const stored = node.inputValues[input.id] ?? input.default
    // Textures have no conversion: the stored value is handed to the backend as is.
    const value = inputType === 'texture' ? stored : convertValue(stored, inputType)
    try {
      return ok(backend.inputValue(ref, value, input.widget))
    } catch (error) {
      return fail(node.id, 'build-failed', describeError(error))
    }
  }

  const resolveInput = (node: GraphNode, input: InputDefinition<string>): Outcome<E> => {
    const ref: PortRef = { nodeId: node.id, portId: input.id }
    const inputType = resolved.inputs.get(portKey(ref))
    if (inputType === undefined) {
      return fail(node.id, 'unresolved-type', `Input ${portKey(ref)} has no resolved type`)
    }
    const edge = incomingByInput.get(portKey(ref))
    if (edge === undefined) return resolveInline(node, input, ref, inputType)
    return resolveConnected(ref, edge, inputType)
  }

  const findProperty = (node: GraphNode): BlackboardProperty | undefined => {
    const propertyId = node.params[PROPERTY_ID_PARAM]
    return graph.properties.find((candidate) => candidate.id === propertyId)
  }

  /** Each property is handed to the backend once; every reader of it shares the expression. */
  const resolveProperty = (node: GraphNode): Outcome<E> => {
    const property = findProperty(node)
    if (property === undefined) {
      return fail(
        node.id,
        'missing-property',
        `Node ${node.id} reads a property that does not exist: ${String(node.params[PROPERTY_ID_PARAM])}`,
      )
    }
    const cached = propertyExpressions.get(property.id)
    if (cached !== undefined) return ok(cached)
    try {
      const expression = backend.property(property)
      propertyExpressions.set(property.id, expression)
      return ok(expression)
    } catch (error) {
      return fail(node.id, 'build-failed', describeError(error))
    }
  }

  const nameOutputs = (
    node: GraphNode,
    definition: AnyNodeDefinition,
    built: NodeOutputs<E>,
  ): NodeOutputs<E> => {
    if (backend.nameOutput === undefined) return built
    const named: Record<string, E> = {}
    for (const output of definition.outputs) {
      const expression = built[output.id]
      if (expression === undefined) continue
      named[output.id] = backend.nameOutput(node, definition, output.id, expression)
    }
    return named
  }

  const buildNode = (node: GraphNode, definition: AnyNodeDefinition): Outcome<NodeOutputs<E>> => {
    const property = definition.reads === 'property' ? resolveProperty(node) : null
    const inputs: Record<string, E> = {}
    const resolvedTypes: Record<string, DataType> = {}
    let hasFailedInput = false

    for (const input of definition.inputs) {
      const expression = resolveInput(node, input)
      const inputType = resolved.inputs.get(portKey({ nodeId: node.id, portId: input.id }))
      if (!expression.ok || inputType === undefined) {
        hasFailedInput = true
        continue
      }
      inputs[input.id] = expression.value
      resolvedTypes[input.id] = inputType
    }
    if (hasFailedInput || (property !== null && !property.ok)) return failed

    try {
      const built = definition.build({
        tsl,
        inputs,
        resolvedTypes,
        params: resolveParams(definition, node.params),
        property: property === null ? null : property.value,
      })
      return ok(nameOutputs(node, definition, built))
    } catch (error) {
      return fail(node.id, 'build-failed', describeError(error))
    }
  }

  function evaluateNode(nodeId: NodeId): Outcome<NodeOutputs<E>> {
    const cached = evaluated.get(nodeId)
    if (cached !== undefined) return cached

    const node = graph.nodes[nodeId]
    const definition = node && registry.get(node.type)
    const outcome =
      node === undefined
        ? fail(nodeId, 'missing-definition', `Node ${nodeId} does not exist in the graph`)
        : definition === undefined
          ? fail(nodeId, 'missing-definition', `No definition registered for ${node.type}`)
          : buildNode(node, definition)
    evaluated.set(nodeId, outcome)
    return outcome
  }

  const compileMaster = (): CompileResult<E> => {
    const master = graph.nodes[MASTER_NODE_ID]
    const definition = registry.get(MASTER_NODE_TYPE)
    if (master === undefined || definition === undefined) {
      fail(MASTER_NODE_ID, 'missing-definition', `No definition registered for ${MASTER_NODE_TYPE}`)
      return { ok: false, errors }
    }

    const slots: Partial<Record<MasterSlot, E>> = {}
    for (const slot of MASTER_SLOTS) {
      const input = definition.inputs.find((candidate) => candidate.id === slot)
      if (input === undefined) continue
      const isConnected = incomingByInput.has(portKey({ nodeId: master.id, portId: slot }))
      if (input.optional === true && !isConnected) continue
      const expression = resolveInput(master, input)
      if (expression.ok) slots[slot] = expression.value
    }
    return errors.length > 0
      ? { ok: false, errors }
      : { ok: true, output: { kind: 'master', slots } }
  }

  const compilePort = (ref: PortRef): CompileResult<E> => {
    const outputs = evaluateNode(ref.nodeId)
    if (!outputs.ok) return { ok: false, errors }
    const expression = outputs.value[ref.portId]
    if (expression === undefined) {
      fail(ref.nodeId, 'unresolved-type', `Output ${portKey(ref)} has no expression`)
      return { ok: false, errors }
    }
    return { ok: true, output: { kind: 'port', expression } }
  }

  return target.kind === 'master' ? compileMaster() : compilePort(target.ref)
}
