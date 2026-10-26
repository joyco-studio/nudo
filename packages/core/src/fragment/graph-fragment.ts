import type { GraphEdge, GraphNode } from '../types/graph'

export const FRAGMENT_KIND = 'nudo-tsl/fragment'

/** A self-contained slice of a graph for the clipboard: edges only join nodes inside it. */
export interface GraphFragment {
  readonly kind: typeof FRAGMENT_KIND
  readonly schemaVersion: 1
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
}
