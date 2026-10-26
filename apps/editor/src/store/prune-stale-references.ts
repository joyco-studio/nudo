import type { Graph } from '@nudo-tsl/core'
import type { UiSlice } from './store-types'

type NodeReferences = Pick<UiSlice, 'selectedNodeIds' | 'draftPositions'>

/**
 * Drops selection and draft positions that point at nodes the graph no longer has.
 * Returns null when nothing is stale, so callers can skip a state update.
 */
export function pruneStaleReferences(graph: Graph, ui: NodeReferences): NodeReferences | null {
  const existingIds = new Set<string>(Object.keys(graph.nodes))
  const selectedNodeIds = ui.selectedNodeIds.filter((id) => existingIds.has(id))
  const draftEntries = Object.entries(ui.draftPositions).filter(([id]) => existingIds.has(id))
  const isSelectionStale = selectedNodeIds.length !== ui.selectedNodeIds.length
  const isDraftStale = draftEntries.length !== Object.keys(ui.draftPositions).length
  if (!isSelectionStale && !isDraftStale) return null
  return { selectedNodeIds, draftPositions: Object.fromEntries(draftEntries) }
}
