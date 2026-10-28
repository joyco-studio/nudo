import { createGraph, parseGraph, serializeGraph } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { recordAutosavePending } from './autosave-pending'
import { useEditorStore } from './editor-store'
import { registry } from './registry'
import type { Notice, UiSlice } from './store-types'

export const AUTOSAVE_KEY = 'nudo-tsl:autosave'
export const AUTOSAVE_CORRUPT_KEY = 'nudo-tsl:autosave:corrupt'
const DEFAULT_AUTOSAVE_DELAY_MS = 500

const RESTORE_FAILED_NOTICE: Notice = {
  kind: 'error',
  messageKey: 'notice.restoreFailedKept',
  persistent: true,
}
const RESTORE_FAILED_DATA_LOST_NOTICE: Notice = {
  kind: 'error',
  messageKey: 'notice.restoreFailed',
  persistent: true,
}
const SAVE_FAILED_NOTICE: Notice = { kind: 'error', messageKey: 'notice.saveFailed' }

function readItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

/** Best effort: failing to keep the corrupt copy must not block starting a fresh graph. */
function keepCorruptCopy(storage: Storage, rawText: string): boolean {
  try {
    storage.setItem(AUTOSAVE_CORRUPT_KEY, rawText)
    return true
  } catch {
    return false
  }
}

export function loadAutosave(storage: Storage): { graph: Graph; notice: UiSlice['notice'] } {
  const rawText = readItem(storage, AUTOSAVE_KEY)
  if (rawText === null) return { graph: createGraph(), notice: null }

  const parsed = parseGraph(rawText, registry)
  if (parsed.ok) return { graph: parsed.value, notice: null }

  const isDataKept = keepCorruptCopy(storage, rawText)
  return {
    graph: createGraph(),
    notice: isDataKept ? RESTORE_FAILED_NOTICE : RESTORE_FAILED_DATA_LOST_NOTICE,
  }
}

/**
 * Saves the graph to `storage` shortly after it stops changing. Returns the unsubscribe.
 * With `page`, a pending save is written at once when the page is hidden or unloaded, so the
 * last edit survives closing the tab inside the debounce window.
 */
export function startAutosave(
  storage: Storage,
  delayMs: number = DEFAULT_AUTOSAVE_DELAY_MS,
  page?: Window,
): () => void {
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  const clearPendingTimer = (): void => {
    if (pendingTimer === null) return
    clearTimeout(pendingTimer)
    pendingTimer = null
    recordAutosavePending(false)
  }

  const save = (): void => {
    pendingTimer = null
    try {
      storage.setItem(AUTOSAVE_KEY, serializeGraph(useEditorStore.getState().graph))
    } catch {
      useEditorStore.getState().showNotice(SAVE_FAILED_NOTICE)
    }
    recordAutosavePending(false)
  }

  const flushPendingSave = (): void => {
    if (pendingTimer === null) return
    clearPendingTimer()
    save()
  }

  const flushWhenHidden = (): void => {
    if (page?.document.visibilityState === 'hidden') flushPendingSave()
  }

  const unsubscribe = useEditorStore.subscribe((state, previousState) => {
    if (state.graph === previousState.graph) return
    clearPendingTimer()
    pendingTimer = setTimeout(save, delayMs)
    recordAutosavePending(true)
  })
  page?.addEventListener('pagehide', flushPendingSave)
  page?.document.addEventListener('visibilitychange', flushWhenHidden)

  return () => {
    unsubscribe()
    clearPendingTimer()
    page?.removeEventListener('pagehide', flushPendingSave)
    page?.document.removeEventListener('visibilitychange', flushWhenHidden)
  }
}
