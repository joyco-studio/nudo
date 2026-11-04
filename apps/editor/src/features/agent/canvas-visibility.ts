import type { XY } from '@nudo-tsl/core'

import { CANVAS_OVERLAY_ATTRIBUTE } from '@/features/canvas/measure-canvas-insets'
import { CANVAS_ID } from '@/shared/lib/landmarks'

/** Marks the off-screen pointer, so it never counts as the canvas showing the agent. */
export const EDGE_INDICATOR_ATTRIBUTE = 'data-agent-edge-indicator'

/** The part of the document the hit test reads; `elementFromPoint` is missing in jsdom. */
export interface HitTestDocument {
  getElementById(id: string): HTMLElement | null
  elementFromPoint?: (x: number, y: number) => Element | null
}

/**
 * Whether the person can see this point of the canvas (viewport pixels): the browser's hit test
 * lands on the canvas, not on a panel over it. It is exact where the panel insets are not: the
 * header's strip spans the whole width but is see-through between its islands, and the presence
 * layer takes no pointer, so the hit falls through to what is under the agent cursor.
 *
 * Null when it cannot tell (no canvas, or a DOM without hit testing); callers fall back to insets.
 */
export function isCanvasPointShown(
  clientPoint: XY,
  doc: HitTestDocument = document,
): boolean | null {
  const canvas = doc.getElementById(CANVAS_ID)
  if (canvas === null || doc.elementFromPoint === undefined) return null
  const hit = doc.elementFromPoint(clientPoint.x, clientPoint.y)
  if (hit === null) return false
  if (hit.closest(`[${EDGE_INDICATOR_ATTRIBUTE}]`) !== null) return false
  return canvas.contains(hit) && hit.closest(`[${CANVAS_OVERLAY_ATTRIBUTE}]`) === null
}
