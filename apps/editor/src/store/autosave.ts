import { createGraph, parseGraph, serializeGraph } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { useEditorStore } from './editor-store'
import { registry } from './registry'
import type { Notice, UiSlice } from './store-types'

export const AUTOSAVE_KEY = 'nudo-tsl:autosave'
export const AUTOSAVE_CORRUPT_KEY = 'nudo-tsl:autosave:corrupt'
const DEFAULT_AUTOSAVE_DELAY_MS = 500

const RESTORE_FAILED_NOTICE: Notice = {
  kind: 'error',
  message:
    "Couldn't restore your last session, so we started a new graph. The previous data was kept.",
}
const SAVE_FAILED_NOTICE: Notice = {
  kind: 'error',
  message: "Couldn't save your work automatically. Your browser storage may be full.",
}

function readItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

/** Best effort: failing to keep the corrupt copy must not block starting a fresh graph. */
function keepCorruptCopy(storage: Storage, rawText: string): void {
  try {
    storage.setItem(AUTOSAVE_CORRUPT_KEY, rawText)
  } catch {
    // Storage is unavailable or full; the user still gets the notice and a working editor.
  }
}

export function loadAutosave(storage: Storage): { graph: Graph; notice: UiSlice['notice'] } {
  const rawText = readItem(storage, AUTOSAVE_KEY)
  if (rawText === null) return { graph: createGraph(), notice: null }

  const parsed = parseGraph(rawText, registry)
  if (parsed.ok) return { graph: parsed.value, notice: null }

  keepCorruptCopy(storage, rawText)
  return { graph: createGraph(), notice: RESTORE_FAILED_NOTICE }
}

/** Saves the graph to `storage` shortly after it stops changing. Returns the unsubscribe. */
export function startAutosave(
  storage: Storage,
  delayMs: number = DEFAULT_AUTOSAVE_DELAY_MS,
): () => void {
  let pendingTimer: ReturnType<typeof setTimeout> | null = null

  const clearPendingTimer = (): void => {
    if (pendingTimer === null) return
    clearTimeout(pendingTimer)
    pendingTimer = null
  }

  const save = (): void => {
    pendingTimer = null
    try {
      storage.setItem(AUTOSAVE_KEY, serializeGraph(useEditorStore.getState().graph))
    } catch {
      useEditorStore.getState().showNotice(SAVE_FAILED_NOTICE)
    }
  }

  const unsubscribe = useEditorStore.subscribe((state, previousState) => {
    if (state.graph === previousState.graph) return
    clearPendingTimer()
    pendingTimer = setTimeout(save, delayMs)
  })

  return () => {
    unsubscribe()
    clearPendingTimer()
  }
}
