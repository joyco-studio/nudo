import { loadPanelPrefs, savePanelPrefs } from '../features/panels/panel-state'
import { loadAutosave, startAutosave } from '../store/autosave'
import { useEditorStore } from '../store/editor-store'

/** Writes the panel preferences whenever they change. Returns the unsubscribe. */
function startPanelPersistence(storage: Storage): () => void {
  return useEditorStore.subscribe((state, previousState) => {
    if (state.panels !== previousState.panels) savePanelPrefs(storage, state.panels)
  })
}

/**
 * Restores the last session (graph and panel layout) into the store and starts saving both. The
 * restored graph is not an undo step, so the history is cleared after loading. Returns a function
 * that stops saving.
 */
export function bootstrapEditor(storage: Storage, page: Window): () => void {
  const { graph, notice } = loadAutosave(storage)
  const panels = loadPanelPrefs(storage)
  useEditorStore.setState({ graph, selectedNodeIds: [], draftPositions: {}, notice, panels })
  useEditorStore.temporal.getState().clear()
  const stopAutosave = startAutosave(storage, undefined, page)
  const stopPanelPersistence = startPanelPersistence(storage)
  return () => {
    stopAutosave()
    stopPanelPersistence()
  }
}
