import type { MouseEvent } from 'react'

import { isTextEntry } from '@/shared/lib/is-text-entry'
import { CANVAS_ID } from '@/shared/lib/landmarks'

import { FLOW_EDGE_SELECTOR, FLOW_NODE_SELECTOR, FLOW_PANE_SELECTOR } from './canvas-keyboard-model'

/** Marks the element a node's or edge's context menu listens on. */
export const CONTEXT_MENU_TRIGGER_ATTRIBUTE = 'data-context-menu-trigger'
export const CONTEXT_MENU_TRIGGER_PROPS = { [CONTEXT_MENU_TRIGGER_ATTRIBUTE]: '' }

const FIRST_MENU_ITEM_SELECTOR =
  '[data-slot="context-menu-content"] [role^="menuitem"]:not([data-disabled])'
/** How far into a node the menu opens: by its header rather than the middle of a tall node. */
const NODE_MENU_INSET_PX = 24

/**
 * For a trigger's `onContextMenuCapture`. React bubbles a right-click inside portalled content (a
 * node's color picker, an open select list) up to the trigger that owns it in the React tree, but
 * that click was not on the trigger, so no menu opens. A right-click in a text field keeps the
 * browser's menu for its own cut, copy and paste.
 */
export function ignoreForeignContextMenu(event: MouseEvent): void {
  const { target, currentTarget } = event
  const isOnTrigger = target instanceof Node && currentTarget.contains(target)
  if (!isOnTrigger || isTextEntry(target)) event.stopPropagation()
}

function menuTargetOf(focused: Element): Element | null {
  if (focused.matches(`${FLOW_NODE_SELECTOR}, ${FLOW_EDGE_SELECTOR}`)) {
    return focused.querySelector(`[${CONTEXT_MENU_TRIGGER_ATTRIBUTE}]`)
  }
  if (focused.matches(FLOW_PANE_SELECTOR)) return focused
  if (focused.id === CANVAS_ID) return focused.querySelector(FLOW_PANE_SELECTOR)
  return null
}

function menuPointIn(target: Element): { clientX: number; clientY: number } {
  const box = target.getBoundingClientRect()
  const isNode = target.closest(FLOW_NODE_SELECTOR) !== null
  return {
    clientX: isNode
      ? box.left + Math.min(box.width / 2, NODE_MENU_INSET_PX)
      : box.left + box.width / 2,
    clientY: isNode
      ? box.top + Math.min(box.height / 2, NODE_MENU_INSET_PX)
      : box.top + box.height / 2,
  }
}

function focusFirstMenuItem(): void {
  document.querySelector<HTMLElement>(FIRST_MENU_ITEM_SELECTOR)?.focus()
}

/**
 * The keyboard path to a context menu (ContextMenu key, Shift+F10): opens the menu of the focused
 * node, edge or canvas as a right-click on it would, then puts focus on the first item. Returns
 * false when the focused element has no menu.
 */
export function openContextMenuFor(focused: Element): boolean {
  const target = menuTargetOf(focused)
  if (target === null) return false
  target.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...menuPointIn(target) }),
  )
  requestAnimationFrame(focusFirstMenuItem)
  return true
}
