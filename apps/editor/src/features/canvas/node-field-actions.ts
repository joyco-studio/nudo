import { createContext, use } from 'react'
import type { ParamRef, ParamValue, PortRef, PortValue } from '@nudo-tsl/core'

import type { GraphChange } from '@/store/store-types'

/**
 * What a node's fields need to edit it: input values (with the live preview channel a scrub or a
 * color pick uses) and params. The canvas and the Inspector both provide it, so the same field
 * components edit the same store state wherever they are drawn.
 */
export interface NodeFieldActions {
  setInputValue: (ref: PortRef, value: PortValue) => void
  /** Shows a value live while a scrub or a color pick is in progress, without committing it. */
  previewInputValue: (ref: PortRef, value: PortValue) => void
  /** Ends the live preview; the final value is committed with `setInputValue`. */
  endInputPreview: () => void
  /** Sets a node param (an enum, a toggle, the collapsed state, a comment title). */
  setParam: (ref: ParamRef, value: ParamValue) => void
  /** Applies a pure graph change (a Color Ramp stop added or removed) as one undo step. */
  changeGraph: (change: GraphChange) => void
}

export const NodeFieldActionsContext = createContext<NodeFieldActions | null>(null)

export function useNodeFieldActions(): NodeFieldActions {
  const actions = use(NodeFieldActionsContext)
  if (actions === null) {
    throw new Error('useNodeFieldActions must be used inside <NodeFieldActionsContext>.')
  }
  return actions
}
