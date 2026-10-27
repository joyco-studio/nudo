import { extractFragment } from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'

import { PASTE_OFFSET } from '@/features/shortcuts/clipboard'
import { useEditorStore } from '@/store/editor-store'

const getStore = () => useEditorStore.getState()

/**
 * Copies nodes, and the edges between them, beside the originals without touching the clipboard
 * (one undo step), and selects the copies. Returns their ids; the master alone gives none.
 */
export function duplicateNodes(nodeIds: readonly NodeId[]): readonly NodeId[] {
  const store = getStore()
  const fragment = extractFragment(store.graph, nodeIds)
  return fragment === null ? [] : store.pasteFragment(fragment, PASTE_OFFSET)
}

/** Selects every node in the graph (Ctrl/⌘ A and the canvas menu). */
export function selectAllNodes(): void {
  const store = getStore()
  store.setSelection(Object.values(store.graph.nodes).map((node) => node.id))
}
