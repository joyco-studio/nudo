import { CANVAS_ID } from '@/shared/lib/landmarks'

import { NO_INSETS, insetsFor } from './viewport-insets'
import type { Insets, ScreenRect } from './viewport-insets'

/** Marks chrome floating over the canvas (the header, the panels): the view keeps clear of it. */
export const CANVAS_OVERLAY_ATTRIBUTE = 'data-canvas-overlay'
export const CANVAS_OVERLAY_PROPS = { [CANVAS_OVERLAY_ATTRIBUTE]: '' }

export interface CanvasArea {
  /** The whole canvas, in viewport pixels. */
  readonly rect: ScreenRect
  /** How far the floating panels reach into it from each edge. */
  readonly insets: Insets
}

/**
 * Measures the canvas and the panels over it right now. Read at the moment a view operation
 * needs it (fit, frame, reveal, place), so it always reflects collapsed, resized and re-laid-out
 * panels without keeping an observer alive between operations.
 */
export function measureCanvasArea(doc: Document = document): CanvasArea {
  const canvas = doc.getElementById(CANVAS_ID)
  const view = doc.defaultView
  if (canvas === null) {
    const width = view?.innerWidth ?? 0
    const height = view?.innerHeight ?? 0
    return { rect: { left: 0, top: 0, right: width, bottom: height }, insets: NO_INSETS }
  }
  const rect = canvas.getBoundingClientRect()
  const overlays = [...doc.querySelectorAll(`[${CANVAS_OVERLAY_ATTRIBUTE}]`)].map((element) =>
    element.getBoundingClientRect(),
  )
  return { rect, insets: insetsFor(rect, overlays) }
}
