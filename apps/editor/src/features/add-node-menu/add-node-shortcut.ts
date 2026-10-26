import { asNodeId } from '@nudo-tsl/core'

import { CANVAS_ID } from '@/shared/lib/landmarks'

import type { PlacementOrigin } from './add-node-placement'

const SPACE_KEY = ' '
const FLOW_NODE_SELECTOR = '.react-flow__node'
const FLOW_PANE_SELECTOR = '.react-flow__pane'

type ShortcutEvent = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'repeat' | 'defaultPrevented' | 'target'
>

function isPlainSpace(event: ShortcutEvent): boolean {
  if (event.key !== SPACE_KEY || event.repeat || event.defaultPrevented) return false
  return !(event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
}

/**
 * Space adds a node only when focus sits on the canvas surface itself: a node, the pane or the
 * canvas landmark. Fields, buttons and menus keep Space for typing and activation.
 */
export function addNodeShortcutOrigin(event: ShortcutEvent): PlacementOrigin | null {
  if (!isPlainSpace(event)) return null
  const { target } = event
  if (!(target instanceof HTMLElement)) return null

  if (target.matches(FLOW_NODE_SELECTOR)) {
    const nodeId = target.dataset.id
    return nodeId === undefined ? null : { kind: 'beside-node', nodeId: asNodeId(nodeId) }
  }
  if (target.id === CANVAS_ID || target.matches(FLOW_PANE_SELECTOR)) {
    return { kind: 'viewport-center' }
  }
  return null
}
