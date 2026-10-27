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

export interface FlowRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The room a node needs before it is measured: a regular node's width and a typical height. */
export const NEW_NODE_SIZE = { width: 224, height: 120 } as const
/** Space left between a placed node and the node it was moved past, in flow units. */
export const PLACEMENT_GAP = 40

function overlaps(a: FlowRect, b: FlowRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/**
 * Where a new node can go near `wanted` without covering another node: it moves right past each
 * node it would overlap, on the same row, until the spot is clear.
 */
export function findFreeSpot(wanted: XY, others: readonly FlowRect[]): XY {
  let spot = wanted
  // Each step clears one node, so there are never more steps than nodes.
  for (let step = 0; step <= others.length; step += 1) {
    const blocker = others.find((other) => overlaps({ ...spot, ...NEW_NODE_SIZE }, other))
    if (blocker === undefined) return spot
    spot = { x: blocker.x + blocker.width + PLACEMENT_GAP, y: spot.y }
  }
  return spot
}
