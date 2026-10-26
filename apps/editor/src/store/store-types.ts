import type {
  CompileError,
  ConnectionCheck,
  EdgeId,
  Graph,
  GraphFragment,
  NodeId,
  NodeTypeId,
  PortRef,
  PortValue,
  XY,
} from '@nudo-tsl/core'
import type { StateCreator } from 'zustand'

export interface GraphSlice {
  graph: Graph
  /** Returns the new node id, or null when the node could not be added. */
  addNode(type: NodeTypeId, position: XY): NodeId | null
  removeNodes(ids: readonly NodeId[]): void
  /**
   * Deletes nodes and edges as one history entry. The master is never deleted: asking for it shows
   * a notice and the rest of the request still goes through.
   */
  removeSelection(nodeIds: readonly NodeId[], edgeIds: readonly EdgeId[]): void
  commitMove(positions: Readonly<Partial<Record<NodeId, XY>>>): void
  setInputValue(ref: PortRef, value: PortValue): void
  connect(from: PortRef, to: PortRef): ConnectionCheck
  disconnect(edgeIds: readonly EdgeId[]): void
  pasteFragment(fragment: GraphFragment, offset: XY): readonly NodeId[]
}

export interface Notice {
  kind: 'info' | 'error'
  message: string
}

/** A value being scrubbed that is shown live but not yet part of the graph. */
export interface InputPreview {
  ref: PortRef
  value: PortValue
}

export interface UiSlice {
  selectedNodeIds: readonly NodeId[]
  /** Live drag positions. They are not part of the undo history. */
  draftPositions: Readonly<Partial<Record<NodeId, XY>>>
  /**
   * The inline value a pointer scrub is showing right now. It is not part of the graph or the
   * undo history: the preview material reads it, and the scrub's release commits it.
   */
  inputPreview: InputPreview | null
  notice: Notice | null
  setSelection(ids: readonly NodeId[]): void
  setDraftPositions(positions: UiSlice['draftPositions']): void
  previewInputValue(ref: PortRef, value: PortValue): void
  clearInputPreview(): void
  showNotice(notice: Notice): void
  dismissNotice(): void
}

export interface CompileSlice {
  errorsByNode: Readonly<Partial<Record<NodeId, string>>>
  setCompileErrors(errors: readonly CompileError[]): void
}

export type EditorState = GraphSlice & UiSlice & CompileSlice

/** A slice creator that lives inside the zundo `temporal` middleware. */
export type EditorSliceCreator<Slice> = StateCreator<
  EditorState,
  [['temporal', unknown]],
  [],
  Slice
>
