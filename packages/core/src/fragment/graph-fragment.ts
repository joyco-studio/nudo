import type { GraphEdge, GraphNode } from '../types/graph'

export const FRAGMENT_KIND = 'nudo-tsl/fragment'

/**
 * Fragments version independently of graphs: they carry nodes and edges but no Blackboard
 * properties, so the graph v2 change did not alter their shape. Graph documents at v2 and
 * fragments at v1 coexist.
 */
export const FRAGMENT_SCHEMA_VERSION = 1

/** A self-contained slice of a graph for the clipboard: edges only join nodes inside it. */
export interface GraphFragment {
  readonly kind: typeof FRAGMENT_KIND
  readonly schemaVersion: typeof FRAGMENT_SCHEMA_VERSION
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
}
