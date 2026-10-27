import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from 'react'

import { isCommandPaletteChord } from '@/features/shortcuts/shortcut-action'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { htmlElementOf } from '@/shared/lib/html-element-of'
import { isInsideOverlay } from '@/shared/lib/is-inside-overlay'
import {
  claimOverlay,
  isOverlayReplaced,
  releaseOverlay,
  useCloseWhenReplaced,
} from '@/shared/lib/overlay-coordinator'

/** Work to do once the palette has closed, given the element that opened it. */
export type AfterCloseTask = (opener: HTMLElement | null) => void

export interface CommandPaletteState {
  readonly isOpen: boolean
  /** The element that had focus when the palette opened; it gets focus back on close. */
  readonly opener: HTMLElement | null
  readonly open: (opener: HTMLElement | null) => void
  /** Pass to the dialog's `onOpenChange` (Escape, a press outside). */
  readonly onOpenChange: (open: boolean) => void
  /**
   * Closes the palette, puts focus back on the opener, then runs the task. Commands that open a
   * dialog or move focus (to a node) do so after the palette is gone, so it can't take focus back.
   */
  readonly closeThenRun: (task: AfterCloseTask) => void
  /** Pass to the dialog content's `onCloseAutoFocus`. */
  readonly onCloseAutoFocus: (event: Event) => void
}

/** Nothing focused reports the body, which can't take focus back: the canvas gets it instead. */
function openerOf(target: EventTarget | null): HTMLElement | null {
  const element = htmlElementOf(target)
  return element === document.body ? null : element
}

/**
 * The command palette's open state and focus. Ctrl/⌘ K opens it from anywhere outside another
 * dialog or menu (text fields included) and closes it again. It takes part in "one overlay at a
 * time", and Escape returns focus to whatever opened it.
 */
export function useCommandPalette(): CommandPaletteState {
  const overlayId = useId()
  const [isOpen, setIsOpenState] = useState(false)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const pendingTaskRef = useRef<AfterCloseTask | null>(null)

  const setIsOpen = useCallback(
    (nextOpen: boolean) => {
      setIsOpenState(nextOpen)
      if (nextOpen) claimOverlay(overlayId)
      else releaseOverlay(overlayId)
    },
    [overlayId],
  )

  useCloseWhenReplaced(overlayId, isOpen, () => {
    setIsOpenState(false)
  })

  const open = useCallback(
    (nextOpener: HTMLElement | null) => {
      pendingTaskRef.current = null
      setOpener(openerOf(nextOpener))
      setIsOpen(true)
    },
    [setIsOpen],
  )

  const closeThenRun = useCallback(
    (task: AfterCloseTask) => {
      pendingTaskRef.current = task
      setIsOpen(false)
    },
    [setIsOpen],
  )

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault()
      const task = pendingTaskRef.current
      pendingTaskRef.current = null
      // Another overlay took over: it owns focus now, and the command was never chosen.
      if (isOverlayReplaced(overlayId)) return
      focusOpenerOrCanvas(opener)
      task?.(opener)
    },
    [overlayId, opener],
  )

  const onPaletteChord = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || !isCommandPaletteChord(event)) return
    if (isOpen) {
      event.preventDefault()
      setIsOpen(false)
      return
    }
    // Another dialog or menu owns the keyboard until it closes.
    if (isInsideOverlay(event.target)) return
    event.preventDefault()
    open(openerOf(event.target))
  })

  useEffect(() => {
    // Capture phase: menus and canvas overlays stop key events from bubbling past them.
    const onKeyDown = (event: KeyboardEvent): void => {
      onPaletteChord(event)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [])

  return { isOpen, opener, open, onOpenChange: setIsOpen, closeThenRun, onCloseAutoFocus }
}
