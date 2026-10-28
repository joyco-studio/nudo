import type { XY } from '@nudo-tsl/core'

/** A box at a position, in flow units. */
export interface PlacedBox {
  readonly position: XY
  readonly width: number
  readonly height: number
}

export interface Bounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The smallest box around every given box. Call it with at least one box. */
export function boundsOf(boxes: readonly PlacedBox[]): Bounds {
  const left = Math.min(...boxes.map((box) => box.position.x))
  const top = Math.min(...boxes.map((box) => box.position.y))
  const right = Math.max(...boxes.map((box) => box.position.x + box.width))
  const bottom = Math.max(...boxes.map((box) => box.position.y + box.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}
