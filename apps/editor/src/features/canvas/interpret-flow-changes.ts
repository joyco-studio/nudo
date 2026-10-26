import { asEdgeId, asNodeId } from '@nudo-tsl/core'
import type { EdgeId, NodeId, XY } from '@nudo-tsl/core'
import type { Dimensions, EdgeChange, NodeChange } from '@xyflow/react'
import type { UiSlice } from '../../store/store-types'
import type { FlowEdge, FlowNode } from './to-flow'

type Positions = UiSlice['draftPositions']

export interface NodeChangeIntent {
  /** Live drag positions to show; null when nothing is being dragged. */
  readonly draftPositions: Positions | null
  /** Positions to commit as one history step; null when no move ended. */
  readonly committedPositions: Positions | null
  /** The next node selection; null when it did not change. */
  readonly selection: readonly NodeId[] | null
  /** Sizes React Flow measured, keyed by node id. */
  readonly dimensions: Readonly<Record<string, Dimensions>>
}

type CurrentUi = Pick<UiSlice, 'draftPositions' | 'selectedNodeIds'>

function hasSameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}

/** Applies React Flow `select` changes to the current selection. */
function nextSelection(
  changes: readonly (NodeChange | EdgeChange)[],
  current: readonly string[],
): string[] {
  const selected = new Set(current)
  for (const change of changes) {
    if (change.type === 'remove') selected.delete(change.id)
    if (change.type !== 'select') continue
    if (change.selected) selected.add(change.id)
    else selected.delete(change.id)
  }
  return [...selected]
}

/**
 * Translates React Flow node changes into store intents. A position change while dragging is a
 * draft; one with `dragging: false` (drag end, keyboard nudge) commits every draft at once.
 * Removals are ignored here: deletion goes through `planDeletion` so it happens once.
 */
export function interpretNodeChanges(
  changes: readonly NodeChange<FlowNode>[],
  current: CurrentUi,
): NodeChangeIntent {
  const drafts: Record<string, XY> = {}
  const finals: Record<string, XY> = {}
  const dimensions: Record<string, Dimensions> = {}

  for (const change of changes) {
    if (change.type === 'dimensions' && change.dimensions !== undefined) {
      dimensions[change.id] = change.dimensions
    }
    if (change.type !== 'position' || change.position === undefined) continue
    if (change.dragging === true) drafts[change.id] = change.position
    else finals[change.id] = change.position
  }

  const hasDrafts = Object.keys(drafts).length > 0
  const hasFinals = Object.keys(finals).length > 0
  const selection = nextSelection(changes, current.selectedNodeIds).map(asNodeId)

  return {
    draftPositions: hasDrafts ? { ...current.draftPositions, ...drafts } : null,
    committedPositions: hasFinals ? { ...current.draftPositions, ...drafts, ...finals } : null,
    selection: hasSameMembers(selection, current.selectedNodeIds) ? null : selection,
    dimensions,
  }
}

/** The next edge selection after React Flow edge changes, or null when it did not change. */
export function interpretEdgeChanges(
  changes: readonly EdgeChange<FlowEdge>[],
  currentSelection: readonly string[],
): string[] | null {
  const selection = nextSelection(changes, currentSelection)
  return hasSameMembers(selection, currentSelection) ? null : selection
}

export interface DeletionPlan {
  readonly nodeIds: readonly NodeId[]
  /** Edges to disconnect. Edges attached to removed nodes go away with their node. */
  readonly edgeIds: readonly EdgeId[]
}

export function planDeletion(
  nodes: readonly { readonly id: string }[],
  edges: readonly { readonly id: string; readonly source: string; readonly target: string }[],
): DeletionPlan {
  const removedNodeIds = new Set(nodes.map((node) => node.id))
  const isDetached = (edge: (typeof edges)[number]): boolean =>
    !removedNodeIds.has(edge.source) && !removedNodeIds.has(edge.target)
  return {
    nodeIds: [...removedNodeIds].map(asNodeId),
    edgeIds: edges.filter(isDetached).map((edge) => asEdgeId(edge.id)),
  }
}
