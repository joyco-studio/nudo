import type { NodeId, PortRef, XY } from '@nudo-tsl/core'

import type { AgentPresence } from '@/store/store-types'

/** A node header's height (`min-h-8`), in flow units: the cursor aims at its middle. */
export const NODE_HEADER_HEIGHT = 32

/** React Flow's viewport transform: a flow point lands at `point * zoom + (x, y)` on screen. */
export interface ViewTransform {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

/** A port handle's box, relative to its node's top-left corner, in flow units. */
export interface HandleBox {
  readonly id: string | null
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** What the canvas knows about a rendered node, in flow units. */
export interface PresenceNode {
  readonly position: XY
  readonly width: number
  readonly height: number
  readonly handles: readonly HandleBox[]
}

/** Resolves presence targets to flow points, and flow points to screen points. */
export interface PresenceLookup {
  /** The middle of a node's header, in flow units; null when the node is not on the canvas. */
  headerCenter(nodeId: NodeId): XY | null
  /** The center of a port handle, in flow units; null when it is not rendered. */
  handleCenter(ref: PortRef): XY | null
  /** A flow point in screen pixels, relative to the canvas' top-left corner. */
  toScreen(point: XY): XY
}

export function flowToScreen(point: XY, transform: ViewTransform): XY {
  return { x: point.x * transform.zoom + transform.x, y: point.y * transform.zoom + transform.y }
}

/** A lookup over the canvas' rendered nodes (React Flow internals, mapped by the caller). */
export function lookupFromNodes(
  nodeFor: (nodeId: NodeId) => PresenceNode | null,
  transform: ViewTransform,
): PresenceLookup {
  return {
    headerCenter(nodeId) {
      const node = nodeFor(nodeId)
      if (node === null) return null
      return { x: node.position.x + node.width / 2, y: node.position.y + NODE_HEADER_HEIGHT / 2 }
    },
    handleCenter(ref) {
      const node = nodeFor(ref.nodeId)
      const handle = node?.handles.find((candidate) => candidate.id === ref.portId)
      if (node === null || handle === undefined) return null
      return {
        x: node.position.x + handle.x + handle.width / 2,
        y: node.position.y + handle.y + handle.height / 2,
      }
    },
    toScreen: (point) => flowToScreen(point, transform),
  }
}

/** Where the agent's cursor points, in flow units: a node's header, a port, or a free point. */
export function flowPointFor(target: AgentPresence['target'], lookup: PresenceLookup): XY | null {
  switch (target.kind) {
    case 'node':
      return lookup.headerCenter(target.nodeId)
    case 'port':
      return lookup.handleCenter(target.ref)
    case 'point':
      return target.position
  }
}

/** Where the agent's cursor points on screen; null when its node or port is not rendered. */
export function screenPointFor(target: AgentPresence['target'], lookup: PresenceLookup): XY | null {
  const point = flowPointFor(target, lookup)
  return point === null ? null : lookup.toScreen(point)
}

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export interface EdgeIndicator {
  readonly x: number
  readonly y: number
  /** The direction from the view's center to the target, in degrees (0 points right). */
  readonly angle: number
}

const DEGREES_PER_RADIAN = 180 / Math.PI

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Where to pin a pointer to an off-screen target: the target clamped to the border, `inset` pixels
 * in. Null while the target is inside the view.
 */
export function edgeIndicatorFor(
  point: XY,
  viewport: ViewportSize,
  inset: number,
): EdgeIndicator | null {
  const isVisible =
    point.x >= 0 && point.x <= viewport.width && point.y >= 0 && point.y <= viewport.height
  if (isVisible) return null
  const center = { x: viewport.width / 2, y: viewport.height / 2 }
  return {
    x: clamp(point.x, inset, viewport.width - inset),
    y: clamp(point.y, inset, viewport.height - inset),
    angle: Math.atan2(point.y - center.y, point.x - center.x) * DEGREES_PER_RADIAN,
  }
}

/** How far the floating panels reach into the canvas from each edge, in pixels. */
export interface PanelInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/**
 * `edgeIndicatorFor` over the part of the canvas the panels leave uncovered: a target behind a
 * panel counts as off-screen, and the pointer stays clear of the panels.
 */
export function edgeIndicatorWithin(
  point: XY,
  canvas: ViewportSize,
  panels: PanelInsets,
  inset: number,
): EdgeIndicator | null {
  const visible = {
    width: Math.max(0, canvas.width - panels.left - panels.right),
    height: Math.max(0, canvas.height - panels.top - panels.bottom),
  }
  const local = { x: point.x - panels.left, y: point.y - panels.top }
  const indicator = edgeIndicatorFor(local, visible, inset)
  if (indicator === null) return null
  return { ...indicator, x: indicator.x + panels.left, y: indicator.y + panels.top }
}

/** How far a wire's curve handles reach out of its ends at least, in pixels. */
const MIN_WIRE_CURVE_PX = 40

/** A pending wire's SVG path: leaves the port horizontally and bends to its loose end. */
export function wirePath(from: XY, to: XY): string {
  const reach = Math.max(Math.abs(to.x - from.x) / 2, MIN_WIRE_CURVE_PX)
  const at = (x: number, y: number): string => `${String(x)} ${String(y)}`
  return `M ${at(from.x, from.y)} C ${at(from.x + reach, from.y)}, ${at(to.x - reach, to.y)}, ${at(to.x, to.y)}`
}

/** A CSS transform that moves an element's top-left corner to `point`, scaled from there. */
export function cssPlacement(point: XY, scale = 1): string {
  return `translate(${String(point.x)}px, ${String(point.y)}px) scale(${String(scale)})`
}

export const sameXY = (a: XY | null, b: XY | null): boolean =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y)
