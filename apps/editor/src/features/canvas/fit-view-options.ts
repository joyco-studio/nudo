import type { FitViewOptions } from '@xyflow/react'

import type { FlowNode } from './to-flow'

const MAX_FIT_ZOOM = 1
const MIN_NARROW_FIT_ZOOM = 0.75

/** Below this width the preview panel covers the canvas top instead of a right-hand column. */
const WIDE_VIEWPORT_PX = 768

/** Keeps fitted nodes clear of the floating header (top) and, when wide, the preview panel. */
export function fitViewOptionsFor(viewportWidth: number): FitViewOptions<FlowNode> {
  if (viewportWidth < WIDE_VIEWPORT_PX) {
    // On a phone, keep fields legible and let the person pan rather than shrink everything.
    return { maxZoom: MAX_FIT_ZOOM, minZoom: MIN_NARROW_FIT_ZOOM, padding: '24px' }
  }
  return {
    maxZoom: MAX_FIT_ZOOM,
    padding: { top: '80px', right: '360px', bottom: '48px', left: '48px' },
  }
}
