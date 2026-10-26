import { asNodeId } from '@nudo-tsl/core'
import type { NodeId, XY } from '@nudo-tsl/core'

import { CANVAS_ID } from '@/shared/lib/landmarks'

/** Pixels a focused node moves per arrow press, and with Shift held. */
const NODE_STEP_PX = 10
const NODE_STEP_SHIFT_PX = 50
/** Pixels the view pans per arrow press when the canvas itself has focus, and with Shift held. */
const PAN_STEP_PX = 40
const PAN_STEP_SHIFT_PX = 160

export const FLOW_NODE_SELECTOR = '.react-flow__node'
export const FLOW_EDGE_SELECTOR = '.react-flow__edge'
const FLOW_PANE_SELECTOR = '.react-flow__pane'
/** Marks the native button inside a port handle. */
export const PORT_BUTTON_ATTRIBUTE = 'data-port-button'

/** What has keyboard focus, as far as the canvas keyboard model cares. */
export type KeyTargetKind = 'node' | 'edge' | 'canvas' | 'field' | 'port' | 'other'

export type CanvasKeyIntent =
  | { readonly kind: 'move-nodes'; readonly delta: XY }
  /** `delta` is where the view moves: ArrowRight looks right, so the content slides left. */
  | { readonly kind: 'pan'; readonly delta: XY }
  | { readonly kind: 'delete' }
  | { readonly kind: 'edit-fields' }
  | { readonly kind: 'leave-field' }

type KeyPress = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>

const ARROW_DIRECTIONS: Readonly<Record<string, XY>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

const DELETE_KEYS: ReadonlySet<string> = new Set(['Delete', 'Backspace'])

function scaled(direction: XY, step: number): XY {
  return { x: direction.x * step, y: direction.y * step }
}

function isDeletable(target: KeyTargetKind): boolean {
  return target === 'node' || target === 'edge' || target === 'canvas'
}

/** Maps a key press on a given kind of target to what the canvas should do, if anything. */
export function canvasKeyIntent(press: KeyPress, target: KeyTargetKind): CanvasKeyIntent | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null

  const direction = ARROW_DIRECTIONS[press.key]
  if (direction !== undefined) {
    if (target === 'node') {
      return {
        kind: 'move-nodes',
        delta: scaled(direction, press.shiftKey ? NODE_STEP_SHIFT_PX : NODE_STEP_PX),
      }
    }
    if (target === 'canvas') {
      return {
        kind: 'pan',
        delta: scaled(direction, press.shiftKey ? PAN_STEP_SHIFT_PX : PAN_STEP_PX),
      }
    }
    return null
  }

  if (DELETE_KEYS.has(press.key) && isDeletable(target)) return { kind: 'delete' }
  if (press.key === 'Enter' && target === 'node') return { kind: 'edit-fields' }
  if (press.key === 'Escape' && target === 'field') return { kind: 'leave-field' }
  return null
}

function isTextEntry(element: Element): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return true
  return element instanceof HTMLElement && element.isContentEditable
}

/** Classifies the element that has focus (a keyboard event's target). */
export function classifyKeyTarget(target: EventTarget | null): KeyTargetKind {
  if (!(target instanceof Element)) return 'other'
  if (target.matches(FLOW_NODE_SELECTOR)) return 'node'
  if (target.matches(FLOW_EDGE_SELECTOR)) return 'edge'
  if (target.id === CANVAS_ID || target.matches(FLOW_PANE_SELECTOR)) return 'canvas'
  if (target.hasAttribute(PORT_BUTTON_ATTRIBUTE)) return 'port'
  if (isTextEntry(target) && target.closest(FLOW_NODE_SELECTOR) !== null) return 'field'
  return 'other'
}

/** The id of the canvas node that is, or contains, the focused element. */
export function flowNodeIdOf(target: EventTarget | null): NodeId | null {
  if (!(target instanceof Element)) return null
  const id = target.closest(FLOW_NODE_SELECTOR)?.getAttribute('data-id') ?? null
  return id === null ? null : asNodeId(id)
}

/**
 * The nodes a keyboard action applies to: the whole selection when the focused node is part of
 * it, otherwise just the focused node (a Tab-focused node is not necessarily selected).
 */
export function resolveActionNodeIds(
  focusedNodeId: NodeId | null,
  selectedNodeIds: readonly NodeId[],
): readonly NodeId[] {
  if (focusedNodeId === null || selectedNodeIds.includes(focusedNodeId)) return selectedNodeIds
  return [focusedNodeId]
}

type Positions = Readonly<Partial<Record<NodeId, XY>>>
type NodesByPosition = Readonly<Partial<Record<NodeId, { readonly position: XY }>>>

/**
 * Moves nodes by `delta`, starting from their draft position when a burst of presses is under
 * way, otherwise from where the graph has them. Ids the graph doesn't know are skipped.
 */
export function nudgePositions(
  nodes: NodesByPosition,
  draftPositions: Positions,
  nodeIds: readonly NodeId[],
  delta: XY,
): Positions {
  const moved: Partial<Record<NodeId, XY>> = {}
  for (const id of nodeIds) {
    const base = draftPositions[id] ?? nodes[id]?.position
    if (base !== undefined) moved[id] = { x: base.x + delta.x, y: base.y + delta.y }
  }
  return moved
}
