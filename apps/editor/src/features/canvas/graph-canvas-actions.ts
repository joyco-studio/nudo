import { createContext, use } from 'react'
import type { PortRef, PortValue } from '@nudo-tsl/core'

/** Store actions node views need. Provided by the canvas container so views stay store-agnostic. */
export interface GraphCanvasActions {
  setInputValue: (ref: PortRef, value: PortValue) => void
}

export const GraphCanvasActionsContext = createContext<GraphCanvasActions | null>(null)

export function useGraphCanvasActions(): GraphCanvasActions {
  const actions = use(GraphCanvasActionsContext)
  if (actions === null) {
    throw new Error('useGraphCanvasActions must be used inside <GraphCanvasActionsContext>.')
  }
  return actions
}
