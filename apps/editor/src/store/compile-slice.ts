import type { CompileError, NodeId } from '@nudo-tsl/core'
import type { CompileSlice, EditorSliceCreator } from './store-types'

/** Keeps the first message reported for each node. */
function indexErrorsByNode(errors: readonly CompileError[]): CompileSlice['errorsByNode'] {
  const messages = new Map<NodeId, string>()
  for (const error of errors) {
    if (!messages.has(error.nodeId)) messages.set(error.nodeId, error.message)
  }
  return Object.fromEntries(messages)
}

export const createCompileSlice: EditorSliceCreator<CompileSlice> = (set) => ({
  errorsByNode: {},
  setCompileErrors: (errors) => {
    set({ errorsByNode: indexErrorsByNode(errors) })
  },
})
