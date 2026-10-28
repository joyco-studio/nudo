import type { FitViewOptions } from '@xyflow/react'

import type { FlowNode } from './to-flow'
import { fitPadding } from './viewport-insets'
import type { Insets } from './viewport-insets'

const MAX_FIT_ZOOM = 1
const MIN_NARROW_FIT_ZOOM = 0.75
/** Room left between fitted nodes and the panels (or the canvas edge), in pixels. */
const FIT_MARGIN_PX = 24

/** Below this canvas width the panels stack over the canvas instead of flanking it. */
const WIDE_CANVAS_PX = 768

/**
 * Fits the nodes inside the part of the canvas the panels leave uncovered (see
 * `viewport-insets`), `FIT_MARGIN_PX` clear of them, and never zooms in past 100%.
 */
export function fitViewOptionsFor(canvasWidth: number, insets: Insets): FitViewOptions<FlowNode> {
  const padding = fitPadding(insets, FIT_MARGIN_PX)
  // On a phone, keep fields legible and let the person pan rather than shrink everything.
  if (canvasWidth < WIDE_CANVAS_PX) {
    return { maxZoom: MAX_FIT_ZOOM, minZoom: MIN_NARROW_FIT_ZOOM, padding }
  }
  return { maxZoom: MAX_FIT_ZOOM, padding }
}
