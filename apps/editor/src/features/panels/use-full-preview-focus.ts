import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'

import type { PreviewLayout } from './panel-state'

/** The preview viewport (keyboard orbit), or the layout picker when no renderer is available. */
const VIEWPORT_SELECTOR = 'canvas[tabindex="0"]'
const CHECKED_LAYOUT_SELECTOR = '[role="radio"][aria-checked="true"]'

function fullPreviewFocusTarget(preview: HTMLElement | null): HTMLElement | null {
  return (
    preview?.querySelector<HTMLElement>(VIEWPORT_SELECTOR) ??
    preview?.querySelector<HTMLElement>(CHECKED_LAYOUT_SELECTOR) ??
    null
  )
}

function isOnCanvasOrNowhere(canvasCell: HTMLElement | null): boolean {
  const focused = document.activeElement
  if (focused === null || focused === document.body) return true
  return canvasCell?.contains(focused) === true
}

/**
 * The full preview covers the canvas and makes it inert, which drops focus to the page. So when
 * the preview goes full while focus was on the canvas, focus moves to the preview viewport.
 * When the preview leaves full with focus still there (Escape, Shift+P), it returns to the canvas
 * element it came from; a person who moved on inside the preview keeps their place.
 */
export function useFullPreviewFocus(
  layout: PreviewLayout,
  canvasCellRef: RefObject<HTMLElement | null>,
  previewRef: RefObject<HTMLElement | null>,
): void {
  const lastCanvasFocusRef = useRef<HTMLElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const placedFocusRef = useRef<HTMLElement | null>(null)
  const previousLayoutRef = useRef(layout)

  useEffect(() => {
    const canvasCell = canvasCellRef.current
    if (canvasCell === null) return
    const remember = (event: FocusEvent): void => {
      if (event.target instanceof HTMLElement) lastCanvasFocusRef.current = event.target
    }
    canvasCell.addEventListener('focusin', remember)
    return () => {
      canvasCell.removeEventListener('focusin', remember)
    }
  }, [canvasCellRef])

  useEffect(() => {
    const previousLayout = previousLayoutRef.current
    previousLayoutRef.current = layout
    if (previousLayout === layout) return

    if (layout === 'full') {
      if (!isOnCanvasOrNowhere(canvasCellRef.current)) return
      const target = fullPreviewFocusTarget(previewRef.current)
      returnFocusRef.current = lastCanvasFocusRef.current
      placedFocusRef.current = target
      target?.focus()
      return
    }
    const returnTarget = returnFocusRef.current
    const isFocusWherePlaced = document.activeElement === placedFocusRef.current
    returnFocusRef.current = null
    placedFocusRef.current = null
    if (returnTarget !== null && isFocusWherePlaced) focusOpenerOrCanvas(returnTarget)
  }, [layout, canvasCellRef, previewRef])
}
