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

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left']

const areaOf = (box: ScreenRect): number => (box.right - box.left) * (box.bottom - box.top)

/** How deep a strip along `side` must reach into the canvas to clear the panel. */
function depthToClear(canvas: ScreenRect, panel: ScreenRect, side: Side): number {
  switch (side) {
    case 'top':
      return panel.bottom - canvas.top
    case 'right':
      return canvas.right - panel.left
    case 'bottom':
      return canvas.bottom - panel.top
    case 'left':
      return panel.right - canvas.left
  }
}

/** The canvas area left uncovered by the insets. */
function visibleArea(canvas: ScreenRect, insets: Insets): number {
  const width = Math.max(0, canvas.right - canvas.left - insets.left - insets.right)
  const height = Math.max(0, canvas.bottom - canvas.top - insets.top - insets.bottom)
  return width * height
}

/**
 * The insets once the panel is cleared along the edge that costs the least extra canvas. A panel
 * already inside a strip costs nothing, so it joins that edge (a short Inspector above a tall
 * Preview counts as right, not top).
 */
function clearPanel(canvas: ScreenRect, insets: Insets, panel: ScreenRect): Insets {
  const before = visibleArea(canvas, insets)
  const options = SIDES.map((side) => {
    const next = { ...insets, [side]: Math.max(insets[side], depthToClear(canvas, panel, side)) }
    return { next, cost: before - visibleArea(canvas, next) }
  })
  return options.reduce((best, option) => (option.cost < best.cost ? option : best)).next
}

/**
 * How much of the canvas the panels cover, per edge. Each panel over the canvas counts toward the
 * edge that clears it for the least canvas, larger panels first; panels beside the canvas, hidden
 * or collapsed to nothing don't count.
 */
export function insetsFor(canvas: ScreenRect, panels: readonly ScreenRect[]): Insets {
  const covered = panels
    .flatMap((panel) => {
      const overlap = intersection(canvas, panel)
      return overlap === null ? [] : [overlap]
    })
    .sort((a, b) => areaOf(b) - areaOf(a))
  const insets = covered.reduce((current, panel) => clearPanel(canvas, current, panel), NO_INSETS)
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
