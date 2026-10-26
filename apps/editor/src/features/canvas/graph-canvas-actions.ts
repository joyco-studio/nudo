import { createContext, use } from 'react'
import type { PortRef, PortValue } from '@nudo-tsl/core'

import type { ConnectCandidate, ConnectOrigin } from './connect-candidates'

/** Store actions node views need. Provided by the canvas container so views stay store-agnostic. */
export interface GraphCanvasActions {
  setInputValue: (ref: PortRef, value: PortValue) => void
  /** Every port the origin can be connected to, read from the graph as it is right now. */
  listConnectCandidates: (origin: ConnectOrigin) => readonly ConnectCandidate[]
  /** Connects the origin to a port on the other side (outputs feed inputs). */
  connectPorts: (origin: ConnectOrigin, target: PortRef) => void
  /** Removes every edge attached to the origin port. */
  disconnectPort: (origin: ConnectOrigin) => void
}

export const GraphCanvasActionsContext = createContext<GraphCanvasActions | null>(null)

export function useGraphCanvasActions(): GraphCanvasActions {
  const actions = use(GraphCanvasActionsContext)
  if (actions === null) {
    throw new Error('useGraphCanvasActions must be used inside <GraphCanvasActionsContext>.')
  }
  return actions
}
