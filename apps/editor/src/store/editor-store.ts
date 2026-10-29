import { create } from 'zustand'
import { temporal } from 'zundo'
import { createCompileSlice } from './compile-slice'
import { createGraphSlice } from './graph-slice'
import { pruneStaleReferences } from './prune-stale-references'
import { createPropertySlice } from './property-slice'
import type { EditorState } from './store-types'
import { createUiSlice } from './ui-slice'

const HISTORY_LIMIT = 100

/**
 * One store, four slices. Only `graph` is tracked by the undo history, and it is compared by
 * reference, so selection, drafts, notices and compile errors never create history entries.
 */
export const useEditorStore = create<EditorState>()(
  temporal(
    (...args) => ({
      ...createGraphSlice(...args),
      ...createPropertySlice(...args),
      ...createUiSlice(...args),
      ...createCompileSlice(...args),
    }),
    {
      partialize: (state) => ({ graph: state.graph }),
      equality: (past, current) => past.graph === current.graph,
      limit: HISTORY_LIMIT,
    },
  ),
)

/** Steps through the history; a step that swaps the graph counts as a new graph generation. */
function travel(step: () => void): void {
  const before = useEditorStore.getState().graph
  step()
  const { graph, graphGeneration } = useEditorStore.getState()
  if (graph !== before) useEditorStore.setState({ graphGeneration: graphGeneration + 1 })
}

export function undo(): void {
  travel(() => {
    useEditorStore.temporal.getState().undo()
  })
}

export function redo(): void {
  travel(() => {
    useEditorStore.temporal.getState().redo()
  })
}

/**
 * Undo and redo restore only `graph`, and deletes remove nodes, so selection and drag drafts can
 * point at missing nodes. This keeps them consistent; it never touches `graph`, so the history
 * (which compares `graph` by reference) gets no entry.
 */
useEditorStore.subscribe((state, previousState) => {
  if (state.graph === previousState.graph) return
  const pruned = pruneStaleReferences(state.graph, state)
  if (pruned !== null) useEditorStore.setState(pruned)
})
