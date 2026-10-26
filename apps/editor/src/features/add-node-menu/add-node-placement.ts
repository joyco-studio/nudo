import type { NodeId, XY } from '@nudo-tsl/core'

/** How far right of the focused node a new node lands, in flow units: clear of a node's width. */
export const BESIDE_NODE_OFFSET_X = 260

/** Where the menu was opened from decides where the picked node is placed. */
export type PlacementOrigin =
  | { readonly kind: 'cursor'; readonly clientX: number; readonly clientY: number }
  | { readonly kind: 'beside-node'; readonly nodeId: NodeId }
  | { readonly kind: 'viewport-center' }

export interface ClientRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export function besideNode(position: XY): XY {
  return { x: position.x + BESIDE_NODE_OFFSET_X, y: position.y }
}

export function rectCenter(rect: ClientRect): XY {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}
