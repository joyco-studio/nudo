import type { Graph, PortRef } from '../types/graph'
import type { PortValue } from '../types/port-value'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import type { GraphError } from './graph-error'

/**
 * Sets the inline value of an unconnected input. Only the node is validated here: this function
 * has no registry, so port ids are not checked against the node definition.
 */
export function setInputValue(
  graph: Graph,
  ref: PortRef,
  value: PortValue,
): Result<Graph, GraphError> {
  const node = graph.nodes[ref.nodeId]
  if (node === undefined) return err({ code: 'node-not-found', nodeId: ref.nodeId })

  const updatedNode = { ...node, inputValues: { ...node.inputValues, [ref.portId]: value } }
  return ok({ ...graph, nodes: { ...graph.nodes, [ref.nodeId]: updatedNode } })
}
