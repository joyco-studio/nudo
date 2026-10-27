import type { SyntheticEvent } from 'react'

/**
 * React Flow skips drag, pan and wheel zoom for events that start inside these classes, and its
 * node and edge key handling (select on Enter, deselect on Escape, move on arrows) for `nokey`.
 */
export const CANVAS_ISOLATION_CLASS = 'nodrag nopan nowheel nokey'

function stopPropagation(event: SyntheticEvent): void {
  event.stopPropagation()
}

/**
 * Handlers for overlay content that portals out of a canvas node or edge (a select list, a
 * context menu). React still bubbles its events to the node, whose React Flow handlers would
 * move the selection on arrow keys or select it on Enter, so they stop at the overlay. The
 * overlay's own handlers on the same element still run.
 */
export const isolateFromCanvas = {
  onKeyDown: stopPropagation,
  onClick: stopPropagation,
  onDoubleClick: stopPropagation,
  onContextMenu: stopPropagation,
} as const
