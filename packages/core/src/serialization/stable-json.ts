import type { GraphEdge, GraphNode } from '../types/graph'
import type { PortValue } from '../types/port-value'

/** Plain-JSON views with a fixed key order, so equal data always serializes to equal text. */

const JSON_INDENT = 2

export const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export const sortedById = <T extends { readonly id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => compareStrings(a.id, b.id))

const sortedEntries = <T>(record: Readonly<Record<string, T>>): [string, T][] =>
  Object.entries(record).sort(([a], [b]) => compareStrings(a, b))

const portValueJson = (value: PortValue) =>
  value.type === 'texture'
    ? { type: value.type, assetId: value.assetId }
    : { type: value.type, value: value.value }

export const nodeJson = (node: GraphNode) => ({
  id: node.id,
  type: node.type,
  position: { x: node.position.x, y: node.position.y },
  inputValues: Object.fromEntries(
    sortedEntries(node.inputValues).map(([key, value]) => [key, portValueJson(value)]),
  ),
  params: Object.fromEntries(sortedEntries(node.params)),
})

export const edgeJson = (edge: GraphEdge) => ({
  id: edge.id,
  from: { nodeId: edge.from.nodeId, portId: edge.from.portId },
  to: { nodeId: edge.to.nodeId, portId: edge.to.portId },
})

export const stringify = (document: unknown): string => JSON.stringify(document, null, JSON_INDENT)
