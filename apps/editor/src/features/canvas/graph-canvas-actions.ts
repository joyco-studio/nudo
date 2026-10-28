import { createContext, use } from 'react'
import type { EdgeId, PortRef, XY } from '@nudo-tsl/core'

import type { ConnectCandidate, ConnectOrigin } from './connect-candidates'
import type { NodeFieldActions } from './node-field-actions'

/**
 * Store actions node views need. Provided by the canvas container so views stay store-agnostic.
 * Actions that also run from the keyboard or the palette (copy, duplicate, delete, select all,
 * fit view) are registry commands instead. Field edits come from `NodeFieldActions`, which the
 * Inspector provides as well.
 */
export interface GraphCanvasActions extends NodeFieldActions {
  /** Every port the origin can be connected to, read from the graph as it is right now. */
  listConnectCandidates: (origin: ConnectOrigin) => readonly ConnectCandidate[]
  /** Connects the origin to a port on the other side (outputs feed inputs). */
  connectPorts: (origin: ConnectOrigin, target: PortRef) => void
  /** Removes every edge attached to the origin port. */
  disconnectPort: (origin: ConnectOrigin) => void
  deleteEdge: (edgeId: EdgeId) => void
  /** Splits a connection around a new reroute centered on a flow point, then focuses it. */
  insertRerouteAt: (edgeId: EdgeId, center: XY) => void
  /** Pastes nudo-tsl nodes from the clipboard with their top-left corner at a screen point. */
  pasteAt: (clientPoint: ClientPoint) => void
  addCommentAt: (clientPoint: ClientPoint) => void
  /** Opens the add-node menu; the picked node lands at the screen point. */
  openAddNodeMenuAt: (clientPoint: ClientPoint) => void
}

/** A point in viewport (client) pixels, where a context menu was opened. */
export interface ClientPoint {
  readonly clientX: number
  readonly clientY: number
}

export const GraphCanvasActionsContext = createContext<GraphCanvasActions | null>(null)

export function useGraphCanvasActions(): GraphCanvasActions {
  const actions = use(GraphCanvasActionsContext)
  if (actions === null) {
    throw new Error('useGraphCanvasActions must be used inside <GraphCanvasActionsContext>.')
  }
  return actions
}
