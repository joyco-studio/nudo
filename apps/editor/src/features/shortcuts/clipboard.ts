import { extractFragment, parseFragment, serializeFragment } from '@nudo-tsl/core'
import type { GraphFragment, NodeId, XY } from '@nudo-tsl/core'

import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'
import type { Notice } from '@/store/store-types'

/** Where pasted and duplicated nodes land relative to the nodes they were copied from. */
export const PASTE_OFFSET: XY = { x: 40, y: 40 }

const NOT_NUDO_NOTICE: Notice = { kind: 'info', messageKey: 'notice.notNudo' }
const COPY_FAILED_NOTICE: Notice = { kind: 'error', messageKey: 'notice.copyFailed' }
const PASTE_FAILED_NOTICE: Notice = { kind: 'error', messageKey: 'notice.pasteFailed' }

const getStore = () => useEditorStore.getState()

/**
 * Copies nodes, and the edges between them, to the system clipboard as text. Defaults to the
 * selection. The master and an empty selection copy nothing.
 */
export async function copySelection(nodeIds?: readonly NodeId[]): Promise<void> {
  const { graph, selectedNodeIds } = getStore()
  const fragment = extractFragment(graph, nodeIds ?? selectedNodeIds)
  if (fragment === null) return
  try {
    await navigator.clipboard.writeText(serializeFragment(fragment))
  } catch {
    getStore().showNotice(COPY_FAILED_NOTICE)
  }
}

async function readClipboardText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}

/** The offset that moves a fragment's top-left corner to `at`. */
function offsetToPlace(fragment: GraphFragment, at: XY): XY {
  const xs = fragment.nodes.map((node) => node.position.x)
  const ys = fragment.nodes.map((node) => node.position.y)
  if (xs.length === 0) return PASTE_OFFSET
  return { x: at.x - Math.min(...xs), y: at.y - Math.min(...ys) }
}

/**
 * Pastes nudo-tsl nodes from the clipboard and focuses the first pasted node. Anything else leaves
 * the graph as it was. Without `at` (a flow point for the top-left corner, such as where a context
 * menu opened) the nodes land 40 px from where they were copied.
 */
export async function pasteFromClipboard(at?: XY): Promise<void> {
  const text = await readClipboardText()
  const store = getStore()
  if (text === null) {
    store.showNotice(PASTE_FAILED_NOTICE)
    return
  }
  const parsed = parseFragment(text, registry)
  if (!parsed.ok) {
    store.showNotice(NOT_NUDO_NOTICE)
    return
  }
  const offset = at === undefined ? PASTE_OFFSET : offsetToPlace(parsed.value, at)
  const [firstPastedId] = store.pasteFragment(parsed.value, offset)
  if (firstPastedId !== undefined) focusFlowNode(firstPastedId)
}
