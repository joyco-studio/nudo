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

export interface UiSlice {
  selectedNodeIds: readonly NodeId[]
  /** Live drag positions. They are not part of the undo history. */
  draftPositions: Readonly<Partial<Record<NodeId, XY>>>
  notice: Notice | null
  setSelection(ids: readonly NodeId[]): void
  setDraftPositions(positions: UiSlice['draftPositions']): void
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
