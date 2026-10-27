import { useMemo, useRef } from 'react'

export interface AfterMenuClose {
  /** Queues work for when the menu has closed, in place of Radix putting focus back. */
  runAfterClose: (task: () => void) => void
  /** Pass to the menu content's `onCloseAutoFocus`. */
  onCloseAutoFocus: (event: Event) => void
}

/**
 * A menu item that moves focus (to a new node, to a dialog, to the canvas after a delete) must
 * wait until the menu has closed: Radix restores focus on close and would take it straight back.
 * Items without a queued task keep Radix's default.
 */
export function useAfterMenuClose(): AfterMenuClose {
  const pendingRef = useRef<(() => void) | null>(null)
  return useMemo(
    () => ({
      runAfterClose: (task) => {
        pendingRef.current = task
      },
      onCloseAutoFocus: (event) => {
        const task = pendingRef.current
        if (task === null) return
        pendingRef.current = null
        event.preventDefault()
        task()
      },
    }),
    [],
  )
}
