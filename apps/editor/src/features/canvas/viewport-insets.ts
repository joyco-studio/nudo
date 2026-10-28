import type { XY } from '@nudo-tsl/core'

/** A box in viewport (client) pixels, as `getBoundingClientRect` reports it. */
export interface ScreenRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** How far the panels floating over the canvas reach in from each of its edges, in pixels. */
export interface Insets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * The least canvas, per axis, that must stay visible once the panels are taken off. Below it (a
 * phone, where the panels stack over most of the canvas) the panels on that axis are ignored, and
 * the person pans past them instead of the view shrinking to a sliver.
 */
const MIN_VISIBLE_PX = 240

type Side = keyof Insets

function intersection(a: ScreenRect, b: ScreenRect): ScreenRect | null {
  const clipped = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  }
  return clipped.left < clipped.right && clipped.top < clipped.bottom ? clipped : null
}

/**
 * The side a panel is docked to: the edge whose strip, cut deep enough to clear the panel, costs
 * the least canvas area. Returns that side and the strip's depth.
 */
function dockedSide(canvas: ScreenRect, panel: ScreenRect): { side: Side; depth: number } {
  const width = canvas.right - canvas.left
  const height = canvas.bottom - canvas.top
  const candidates: readonly { side: Side; depth: number; area: number }[] = [
    { side: 'left', depth: panel.right - canvas.left, area: (panel.right - canvas.left) * height },
    { side: 'right', depth: canvas.right - panel.left, area: (canvas.right - panel.left) * height },
    { side: 'top', depth: panel.bottom - canvas.top, area: (panel.bottom - canvas.top) * width },
    {
      side: 'bottom',
      depth: canvas.bottom - panel.top,
      area: (canvas.bottom - panel.top) * width,
    },
  ]
  return candidates.reduce((best, candidate) => (candidate.area < best.area ? candidate : best))
}

/**
 * How much of the canvas the panels cover, per edge. Each panel over the canvas counts toward the
 * edge it is docked to; panels beside the canvas, hidden or collapsed to nothing don't count.
 */
export function insetsFor(canvas: ScreenRect, panels: readonly ScreenRect[]): Insets {
  const insets = { ...NO_INSETS }
  for (const panel of panels) {
    const covered = intersection(canvas, panel)
    if (covered === null) continue
    const { side, depth } = dockedSide(canvas, covered)
    insets[side] = Math.max(insets[side], depth)
  }
  const width = canvas.right - canvas.left
  const height = canvas.bottom - canvas.top
  const isWideEnough = width - insets.left - insets.right >= MIN_VISIBLE_PX
  const isTallEnough = height - insets.top - insets.bottom >= MIN_VISIBLE_PX
  return {
    top: isTallEnough ? insets.top : 0,
    right: isWideEnough ? insets.right : 0,
    bottom: isTallEnough ? insets.bottom : 0,
    left: isWideEnough ? insets.left : 0,
  }
}

type PixelPadding = `${number}px`

/** React Flow fit padding that keeps fitted nodes `margin` pixels clear of every panel. */
export function fitPadding(insets: Insets, margin: number): Record<Side, PixelPadding> {
  const pixels = (value: number): PixelPadding =>
    // React Flow types pixel padding as `${number}px`, which only a number in the template yields.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `${value + margin}px`
  return {
    top: pixels(insets.top),
    right: pixels(insets.right),
    bottom: pixels(insets.bottom),
    left: pixels(insets.left),
  }
}

/** Where the middle of the uncovered canvas is, relative to the middle of the whole canvas. */
export function visibleCenterOffset(insets: Insets): XY {
  return { x: (insets.left - insets.right) / 2, y: (insets.top - insets.bottom) / 2 }
}

/** The middle of the uncovered canvas, in viewport pixels. */
export function visibleCenter(canvas: ScreenRect, insets: Insets): XY {
  const offset = visibleCenterOffset(insets)
  return {
    x: (canvas.left + canvas.right) / 2 + offset.x,
    y: (canvas.top + canvas.bottom) / 2 + offset.y,
  }
}
