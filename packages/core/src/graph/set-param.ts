import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, ParamValue } from '../types/graph'
import type { NodeId } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { findParamDefinition, isValidParamValue } from '../validation/param-validation'
import type { GraphError } from './graph-error'

export interface ParamRef {
  readonly nodeId: NodeId
  readonly paramId: string
}

/**
 * Sets a structural param. The param must be declared by the node's definition or be a universal
 * param, and the value must fit it. Changes to non-universal params recompile.
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

  const updatedNode = { ...node, params: { ...node.params, [ref.paramId]: value } }
  return ok({ ...graph, nodes: { ...graph.nodes, [ref.nodeId]: updatedNode } })
}
