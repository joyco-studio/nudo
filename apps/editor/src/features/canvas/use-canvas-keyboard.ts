import { useEffect, useEffectEvent, useRef } from 'react'
import { asEdgeId } from '@nudo-tsl/core'
import type { XY } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useEditorStore } from '@/store/editor-store'

import {
  FLOW_NODE_SELECTOR,
  PORT_BUTTON_ATTRIBUTE,
  canvasKeyIntent,
  classifyKeyTarget,
  flowNodeIdOf,
  nudgePositions,
  resolveActionNodeIds,
} from './canvas-keyboard-model'
import type { CanvasKeyIntent } from './canvas-keyboard-model'

const FIRST_FIELD_SELECTOR = 'input:not([type="hidden"]), textarea'
const FIRST_PORT_SELECTOR = `[${PORT_BUTTON_ATTRIBUTE}]`

const getStore = () => useEditorStore.getState()

function moveFocusedNodes(event: KeyboardEvent, delta: XY): void {
  const store = getStore()
  const { graph, draftPositions } = store
  const ids = resolveActionNodeIds(flowNodeIdOf(event.target), store.selectedNodeIds)
  store.setDraftPositions({
    ...draftPositions,
    ...nudgePositions(graph.nodes, draftPositions, ids, delta),
  })
}

/** Keeps focus on the canvas when the element that had it was deleted. */
function refocusCanvasIfRemoved(element: EventTarget | null): void {
  if (!(element instanceof Element)) return
  requestAnimationFrame(() => {
    if (!element.isConnected) document.getElementById(CANVAS_ID)?.focus({ preventScroll: true })
  })
}

function deleteFromKeyboard(event: KeyboardEvent, selectedEdgeIds: readonly string[]): void {
  const store = getStore()
  const target = event.target instanceof Element ? event.target : null
  const kind = classifyKeyTarget(target)

  if (kind === 'edge') {
    const edgeId = target?.getAttribute('data-id') ?? null
    if (edgeId !== null) store.removeSelection([], [asEdgeId(edgeId)])
  } else if (kind === 'node') {
    store.removeSelection(resolveActionNodeIds(flowNodeIdOf(target), store.selectedNodeIds), [])
  } else {
    const knownEdgeIds = selectedEdgeIds.filter((id) => id in store.graph.edges)
    store.removeSelection(store.selectedNodeIds, knownEdgeIds.map(asEdgeId))
  }
  refocusCanvasIfRemoved(target)
}

/** Steps into a node: its first field, or its first port when it has no inline fields. */
function focusFirstEntry(event: KeyboardEvent): void {
  if (!(event.target instanceof HTMLElement)) return
  const entry =
    event.target.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR) ??
    event.target.querySelector<HTMLElement>(FIRST_PORT_SELECTOR)
  if (entry === null) return
  event.preventDefault()
  entry.focus()
}

function focusOwningNode(event: KeyboardEvent): void {
  if (!(event.target instanceof Element)) return
  const node = event.target.closest(FLOW_NODE_SELECTOR)
  if (node instanceof HTMLElement) node.focus({ preventScroll: true })
}

/**
 * The canvas keyboard model: arrows move the focused node (or pan the view when the canvas itself
 * has focus), Delete removes, Enter steps into a node's fields (or ports) and Escape steps back out.
 *
 * Node moves are one history entry per burst: each press updates a draft, and the draft is
 * committed when the last arrow key is released.
 */
export function useCanvasKeyboard(selectedEdgeIds: readonly string[]): void {
  const { getViewport, setViewport } = useReactFlow()
  const heldArrowKeys = useRef(new Set<string>())

  const commitBurst = useEffectEvent(() => {
    heldArrowKeys.current.clear()
    const store = getStore()
    if (Object.keys(store.draftPositions).length > 0) store.commitMove(store.draftPositions)
  })

  const runIntent = useEffectEvent((event: KeyboardEvent, intent: CanvasKeyIntent) => {
    switch (intent.kind) {
      case 'move-nodes':
        // Capture phase plus stopPropagation keeps React Flow's own arrow handling out of it.
        event.preventDefault()
        event.stopPropagation()
        heldArrowKeys.current.add(event.key)
        moveFocusedNodes(event, intent.delta)
        return
      case 'pan': {
        event.preventDefault()
        const viewport = getViewport()
        void setViewport({
          ...viewport,
          x: viewport.x - intent.delta.x,
          y: viewport.y - intent.delta.y,
        })
        return
      }
      case 'delete':
        event.preventDefault()
        deleteFromKeyboard(event, selectedEdgeIds)
        return
      case 'edit-fields':
        focusFirstEntry(event)
        return
      case 'leave-field':
        focusOwningNode(event)
        return
    }
  })

  useEffect(() => {
    const onKeyDownCapture = (event: KeyboardEvent): void => {
      const intent = canvasKeyIntent(event, classifyKeyTarget(event.target))
      if (intent !== null && intent.kind !== 'leave-field') runIntent(event, intent)
    }
    // Escape runs after the field's own handler has reverted its draft, so leaving it never
    // commits what was typed.
    const onKeyDown = (event: KeyboardEvent): void => {
      const intent = canvasKeyIntent(event, classifyKeyTarget(event.target))
      if (intent?.kind === 'leave-field') runIntent(event, intent)
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      const wasHeld = heldArrowKeys.current.delete(event.key)
      if (wasHeld && heldArrowKeys.current.size === 0) commitBurst()
    }
    const onBlur = (): void => {
      if (heldArrowKeys.current.size > 0) commitBurst()
    }
    window.addEventListener('keydown', onKeyDownCapture, { capture: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDownCapture, { capture: true })
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
