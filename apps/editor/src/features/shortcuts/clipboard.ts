import { extractFragment, parseFragment, serializeFragment } from '@nudo-tsl/core'
import type { NodeId, XY } from '@nudo-tsl/core'

import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'
import type { Notice } from '@/store/store-types'

/** Where pasted nodes land relative to the nodes they were copied from. */
const PASTE_OFFSET: XY = { x: 40, y: 40 }

const NOT_NUDO_NOTICE: Notice = {
  kind: 'info',
  message: "Clipboard doesn't contain nudo-tsl nodes",
}
const COPY_FAILED_NOTICE: Notice = { kind: 'error', message: "Couldn't copy to the clipboard" }
const PASTE_FAILED_NOTICE: Notice = { kind: 'error', message: "Couldn't read the clipboard" }

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

/** Pastes nudo-tsl nodes from the clipboard. Anything else leaves the graph as it was. */
export async function pasteFromClipboard(): Promise<void> {
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
  store.pasteFragment(parsed.value, PASTE_OFFSET)
}
