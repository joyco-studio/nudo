import { loadAutosave, startAutosave } from '../store/autosave'
import { useEditorStore } from '../store/editor-store'

/**
 * Restores the last session into the store and starts saving it. The restored graph is not an
 * undo step, so the history is cleared after loading. Returns a function that stops autosave.
 */
export function bootstrapEditor(storage: Storage, page: Window): () => void {
  const { graph, notice } = loadAutosave(storage)
  useEditorStore.setState({ graph, selectedNodeIds: [], draftPositions: {}, notice })
  useEditorStore.temporal.getState().clear()
  return startAutosave(storage, undefined, page)
}
