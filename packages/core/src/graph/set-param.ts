import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, GraphNode, ParamValue } from '../types/graph'
import type { NodeId } from '../types/ids'
import { PROPERTY_ID_PARAM } from '../types/param-definition'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { REPEAT_INPUT_PARAM, repeatLinks } from '../repeat/repeat-zone'
import { asNodeId } from '../types/ids'
import { findParamDefinition, isValidParamValue } from '../validation/param-validation'
import { wouldCreateCycle } from '../validation/would-create-cycle'
import type { GraphError } from './graph-error'

export interface ParamRef {
  readonly nodeId: NodeId
  readonly paramId: string
}

/**
 * Sets a structural param. The param must be declared by the node's definition or be a universal
 * param, and the value must fit it. On property readers, `propertyId` must name an existing
 * property; on a Repeat Output, `repeatInput` must name a Repeat Input no other output uses and
 * that does not read this output's results. Changes to non-universal params recompile.
 */
export function setParam(
  graph: Graph,
  registry: NodeRegistry,
  ref: ParamRef,
  value: ParamValue,
): Result<Graph, GraphError> {
  const node = graph.nodes[ref.nodeId]
  if (node === undefined) return err({ code: 'node-not-found', nodeId: ref.nodeId })
  const definition = registry.get(node.type)
  if (definition === undefined) return err({ code: 'unknown-node-type', type: node.type })

  const param = findParamDefinition(definition, ref.paramId)
  if (param === undefined) {
    return err({ code: 'unknown-param', nodeId: ref.nodeId, paramId: ref.paramId })
  }
  if (!isValidParamValue(param, value)) {
    return err({ code: 'invalid-param-value', nodeId: ref.nodeId, paramId: ref.paramId })
  }

  const isPropertyReference = definition.reads === 'property' && ref.paramId === PROPERTY_ID_PARAM
  const isKnownProperty = graph.properties.some((property) => property.id === value)
  if (isPropertyReference && !isKnownProperty) {
    return err({ code: 'property-not-found', id: String(value) })
  }

  const isRepeatPairing = definition.repeat === 'output' && ref.paramId === REPEAT_INPUT_PARAM
  if (isRepeatPairing && !canPairWith(graph, registry, node, String(value))) {
    return err({ code: 'invalid-param-value', nodeId: ref.nodeId, paramId: ref.paramId })
  }

  const updatedNode = { ...node, params: { ...node.params, [ref.paramId]: value } }
  return ok({ ...graph, nodes: { ...graph.nodes, [ref.nodeId]: updatedNode } })
}

/** Whether the Repeat Output `output` may pair with the node `inputId`. */
function canPairWith(
  graph: Graph,
  registry: NodeRegistry,
  output: GraphNode,
  inputId: string,
): boolean {
  const input = graph.nodes[asNodeId(inputId)]
  if (input === undefined || registry.get(input.type)?.repeat !== 'input') return false
  // The graph as it would be with the output unpaired: what else holds the input, what links stay.
  const unpaired = { ...output, params: {} }
  const without: Graph = { ...graph, nodes: { ...graph.nodes, [output.id]: unpaired } }
  const isTaken = repeatLinks(without).some((link) => link.input === input.id)
  // The pair counts as an edge from input to output: it must not close a loop either.
  const closesLoop = wouldCreateCycle(
    without,
    { nodeId: input.id, portId: REPEAT_INPUT_PARAM },
    { nodeId: output.id, portId: REPEAT_INPUT_PARAM },
  )
  return !isTaken && !closesLoop
}
