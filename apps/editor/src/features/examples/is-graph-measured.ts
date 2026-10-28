import type { Graph } from '@nudo-tsl/core'

/** What the canvas knows of a node's rendered size (React Flow's `measured`). */
export interface MeasuredSize {
  readonly width?: number | undefined
  readonly height?: number | undefined
}

const hasSize = (size: MeasuredSize | undefined): boolean =>
  (size?.width ?? 0) > 0 && (size?.height ?? 0) > 0

/**
 * Whether the canvas holds every node of `graph` with a measured size, so fitting the view now
 * frames all of it. Sizes kept from an earlier graph with the same ids count: they are the same
 * nodes, so they already measure the same.
 */
export function isGraphMeasured(
  graph: Graph,
  sizeOf: (nodeId: string) => MeasuredSize | undefined,
): boolean {
  return Object.keys(graph.nodes).every((nodeId) => hasSize(sizeOf(nodeId)))
}
