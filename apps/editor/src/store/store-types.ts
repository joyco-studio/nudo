import type {
  CompileError,
  ConnectionCheck,
  EdgeId,
  Graph,
  GraphFragment,
  NodeId,
  NodeTypeId,
  ParamRef,
  ParamValue,
  PortRef,
  PortValue,
  XY,
} from '@nudo-tsl/core'
import type { StateCreator } from 'zustand'

import type {
  NonFullPreviewLayout,
  PanelId,
  PanelPrefs,
  PreviewBackdrop,
  PreviewLayout,
} from '@/features/panels/panel-state'

/** Where a resizable node (a comment frame) ends up after a resize. */
export interface NodeFrame {
  readonly position: XY
  readonly width: number
  readonly height: number
}

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
  /** One history entry; does nothing when the value the node shows would not change. */
  setParam(ref: ParamRef, value: ParamValue): void
  /** Commits a resize (position, `width` and `height` params) as one history entry. */
  commitResize(nodeId: NodeId, frame: NodeFrame): void
  /** Replaces the graph with a fresh one (master only, no properties) as one history entry. */
  resetGraph(): void
}

export interface Notice {
  kind: 'info' | 'error'
  message: string
  /**
   * The person has to acknowledge it: its toast never closes by itself and offers a Dismiss
   * action instead of a close button.
   */
  persistent?: boolean
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
  /** Panel layout preferences, persisted to `nudo-tsl:panels`. */
  panels: PanelPrefs
  /** The layout Escape returns to when leaving the full preview. */
  layoutBeforeFull: NonFullPreviewLayout
  /** The split while its handle is being dragged; stored (and persisted) only on release. */
  splitDraftPercent: number | null
  setSelection(ids: readonly NodeId[]): void
  setDraftPositions(positions: UiSlice['draftPositions']): void
  previewInputValue(ref: PortRef, value: PortValue): void
  clearInputPreview(): void
  showNotice(notice: Notice): void
  dismissNotice(): void
  togglePanel(id: PanelId): void
  /** Also expands a collapsed preview, so the chosen layout shows. */
  setPreviewLayout(layout: PreviewLayout): void
  cyclePreviewLayout(): void
  exitFullPreview(): void
  setSplitPercent(percent: number): void
  draftSplitPercent(percent: number): void
  /** Stores the dragged split, if any, and ends the drag. */
  commitSplitDraft(): void
  /** Ends a draft that no person made (a layout the library adjusted on its own). */
  discardSplitDraft(): void
  setPreviewBackdrop(backdrop: PreviewBackdrop): void
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
