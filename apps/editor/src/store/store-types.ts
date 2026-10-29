import type {
  CompileError,
  ConnectionCheck,
  EdgeId,
  Graph,
  GraphFragment,
  NodeId,
  NodeRegistry,
  NodeTypeId,
  ParamRef,
  ParamValue,
  PortRef,
  PortValue,
  PropertyError,
  PropertyId,
  Result,
  XY,
} from '@nudo-tsl/core'
import type { StateCreator } from 'zustand'

import type { MessageKey } from '@/i18n/translate'

import type { PropertyKind } from '@/features/blackboard/property-kinds'
import type { PreviewShape } from '@/features/main-preview/preview-shape'
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

/**
 * A pure edit of the whole graph (a Color Ramp stop added, removed or moved), run against the
 * graph as it is when it is applied. The error says why it was refused.
 */
export type GraphChange = (graph: Graph, registry: NodeRegistry) => Result<Graph, string>

export interface GraphSlice {
  graph: Graph
  /**
   * Counts the times the whole graph was swapped (replaced, reset, undone or redone). Work that
   * replaces the graph after an await reads it first and gives up when it has moved on since.
   */
  graphGeneration: number
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
  /**
   * Splits a connection around a new reroute node at `position` (one history entry) and selects
   * it. Returns its id, or null (with a notice) when the connection can't take one.
   */
  insertReroute(edgeId: EdgeId, position: XY): NodeId | null
  pasteFragment(fragment: GraphFragment, offset: XY): readonly NodeId[]
  /** One history entry; does nothing when the value the node shows would not change. */
  setParam(ref: ParamRef, value: ParamValue): void
  /** Commits a resize (position, `width` and `height` params) as one history entry. */
  commitResize(nodeId: NodeId, frame: NodeFrame): void
  /** Replaces the graph with a fresh one (master only, no properties) as one history entry. */
  resetGraph(): void
  /** Replaces the graph with another one (an example) as one history entry. */
  replaceGraph(graph: Graph): void
  /**
   * Applies a pure graph change as one history entry, keeping the selection. Returns why it was
   * refused (nothing changes then), or null.
   */
  applyGraphChange(change: GraphChange): string | null
}

/**
 * Blackboard property actions. Each change that reaches the graph is one history entry; a change
 * that would leave the property as it is creates none.
 */
export interface PropertySlice {
  /** Adds an exposed property with a unique default name (`float1`, `color1`, …). */
  addProperty(kind: PropertyKind): PropertyId | null
  /**
   * Renames the display label. While the reference name is still the one the label suggests
   * (generated, not chosen by hand), it follows the new label in the same history entry.
   * Returns null on success.
   */
  renamePropertyLabel(id: PropertyId, label: string): PropertyError | null
  /** Renames the reference (the uniform name). Returns why a name was rejected, or null. */
  renameProperty(id: PropertyId, name: string): PropertyError | null
  setPropertyExposed(id: PropertyId, exposed: boolean): void
  setPropertyValue(id: PropertyId, value: PortValue): void
  /** Removes the property with every node that reads it and their edges: one history entry. */
  removeProperty(id: PropertyId): void
  /** Adds a reader node of the property. Returns its id, or null when it could not be added. */
  addPropertyNode(id: PropertyId, position: XY): NodeId | null
}

export interface Notice {
  kind: 'info' | 'error'
  /** Shown in the UI language when the toast renders. */
  messageKey: MessageKey
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

/** A property value being scrubbed or picked, shown live but not yet part of the graph. */
export interface PropertyPreview {
  id: PropertyId
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
  /** Like `inputPreview`, for a Blackboard property value. */
  propertyPreview: PropertyPreview | null
  notice: Notice | null
  /** Panel layout preferences, persisted to `nudo-tsl:panels`. */
  panels: PanelPrefs
  /** The layout Escape returns to when leaving the full preview. */
  layoutBeforeFull: NonFullPreviewLayout
  /** The split while its handle is being dragged; stored (and persisted) only on release. */
  splitDraftPercent: number | null
  /** The mesh the Main Preview draws the material on. Not saved: a preview choice, not the graph. */
  previewShape: PreviewShape
  setSelection(ids: readonly NodeId[]): void
  setDraftPositions(positions: UiSlice['draftPositions']): void
  previewInputValue(ref: PortRef, value: PortValue): void
  clearInputPreview(): void
  previewPropertyValue(id: PropertyId, value: PortValue): void
  clearPropertyPreview(): void
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
  setPreviewShape(shape: PreviewShape): void
}

export interface CompileSlice {
  errorsByNode: Readonly<Partial<Record<NodeId, string>>>
  setCompileErrors(errors: readonly CompileError[]): void
}

export type EditorState = GraphSlice & PropertySlice & UiSlice & CompileSlice

/** A slice creator that lives inside the zundo `temporal` middleware. */
export type EditorSliceCreator<Slice> = StateCreator<
  EditorState,
  [['temporal', unknown]],
  [],
  Slice
>
