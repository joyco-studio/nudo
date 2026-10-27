import { useId, useMemo, useRef, useState } from 'react'

import {
  claimOverlay,
  dismissTopLayer,
  isOverlayReplaced,
  releaseOverlay,
  useCloseWhenReplaced,
} from '@/shared/lib/overlay-coordinator'

export interface CanvasMenu {
  /** Pass to the menu root's `onOpenChange`: the menu takes part in "one overlay at a time". */
  onOpenChange: (open: boolean) => void
  /** Queues work for when the menu has closed, in place of Radix putting focus back. */
  runAfterClose: (task: () => void) => void
  /** Pass to the menu content's `onCloseAutoFocus`. */
  onCloseAutoFocus: (event: Event) => void
}

/**
 * Wiring every canvas context menu shares:
 * - Opening it closes any other overlay, and another overlay opening closes it.
 * - An item that moves focus (to a new node, to a dialog, to the canvas after a delete) waits
 *   until the menu has closed: Radix restores focus on close and would take it straight back.
 *   Items without a queued task keep Radix's default, and a replaced menu leaves focus alone.
 */
export function useCanvasMenu(): CanvasMenu {
  const overlayId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const pendingRef = useRef<(() => void) | null>(null)

  useCloseWhenReplaced(overlayId, isOpen, dismissTopLayer)

  return useMemo(
    () => ({
      onOpenChange: (open) => {
        setIsOpen(open)
        if (open) claimOverlay(overlayId)
        else releaseOverlay(overlayId)
      },
      runAfterClose: (task) => {
        pendingRef.current = task
      },
      onCloseAutoFocus: (event) => {
        const task = pendingRef.current
        pendingRef.current = null
        if (task === null && !isOverlayReplaced(overlayId)) return
        event.preventDefault()
        task?.()
      },
    }),
    [overlayId],
  )
}
