import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { NodeId, NodeTypeId, XY } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { COMMENT_NODE_TYPE } from '@/features/canvas/to-flow'
import type { FlowNode } from '@/features/canvas/to-flow'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
import { CANVAS_ID } from '@/shared/lib/landmarks'
import {
  claimOverlay,
  isOverlayReplaced,
  releaseOverlay,
  useCloseWhenReplaced,
} from '@/shared/lib/overlay-coordinator'
import { useEditorStore } from '@/store/editor-store'

import { AddNodeMenu } from './add-node-menu'
import { AddNodeMenuContext } from './add-node-menu-context'
import type { AddNodeAt, AddNodeMenuApi, OpenAddNodeMenu } from './add-node-menu-context'
import { NEW_NODE_SIZE, besideNode, findFreeSpot, rectCenter } from './add-node-placement'
import type { FlowRect, PlacementOrigin } from './add-node-placement'
import { useAddNodeShortcut } from './use-add-node-shortcut'

/** Where focus goes when the menu closes: the node just added, or whatever opened the menu. */
type FocusOnClose =
  | { readonly kind: 'new-node'; readonly nodeId: NodeId }
  | { readonly kind: 'opener'; readonly element: HTMLElement | null }

function canvasElement(): HTMLElement | null {
  return document.getElementById(CANVAS_ID)
}

/** Screen point at the middle of the canvas, or the window when the canvas isn't mounted. */
function viewportCenter(): XY {
  const rect = canvasElement()?.getBoundingClientRect()
  return rectCenter(
    rect ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight },
  )
}

/** The nodes a new node must not cover. Comment frames sit behind nodes, so they don't count. */
function occupiedRects(nodes: readonly FlowNode[]): FlowRect[] {
  return nodes
    .filter((node) => node.type !== COMMENT_NODE_TYPE)
    .map((node) => ({
      ...node.position,
      width: node.measured?.width ?? NEW_NODE_SIZE.width,
      height: node.measured?.height ?? NEW_NODE_SIZE.height,
    }))
}

/** Adds a node (one history entry) and selects it. */
function addAndSelect(type: NodeTypeId, position: XY): NodeId | null {
  const store = useEditorStore.getState()
  const nodeId = store.addNode(type, position)
  if (nodeId !== null) store.setSelection([nodeId])
  return nodeId
}

interface AddNodeMenuProviderProps {
  children: ReactNode
}

/**
 * Owns the add-node menu: opening it (Space, header button, pane right-click), placing the picked
 * node, and moving focus afterwards. Must sit inside a `ReactFlowProvider`.
 */
export function AddNodeMenuProvider({ children }: AddNodeMenuProviderProps) {
  const { screenToFlowPosition, getNodes } = useReactFlow<FlowNode>()
  const [isOpen, setIsOpenState] = useState(false)
  const overlayId = useId()
  // One overlay at a time: opening the menu closes any other, and another one opening closes it.
  const setIsOpen = useCallback(
    (open: boolean) => {
      setIsOpenState(open)
      if (open) claimOverlay(overlayId)
      else releaseOverlay(overlayId)
    },
    [overlayId],
  )
  useCloseWhenReplaced(overlayId, isOpen, () => {
    setIsOpenState(false)
  })
  const placementRef = useRef<XY>({ x: 0, y: 0 })
  const focusOnCloseRef = useRef<FocusOnClose>({ kind: 'opener', element: null })

  const resolvePlacement = useCallback(
    (origin: PlacementOrigin): XY => {
      if (origin.kind === 'cursor') {
        return screenToFlowPosition({ x: origin.clientX, y: origin.clientY })
      }
      const node =
        origin.kind === 'beside-node'
          ? useEditorStore.getState().graph.nodes[origin.nodeId]
          : undefined
      const wanted =
        node === undefined ? screenToFlowPosition(viewportCenter()) : besideNode(node.position)
      // Space and the header button aim at a spot; a node already there is skipped, not covered.
      return findFreeSpot(wanted, occupiedRects(getNodes()))
    },
    [screenToFlowPosition, getNodes],
  )

  const openMenu = useCallback<OpenAddNodeMenu>(
    (origin, opener) => {
      placementRef.current = resolvePlacement(origin)
      focusOnCloseRef.current = { kind: 'opener', element: opener }
      setIsOpen(true)
    },
    [resolvePlacement, setIsOpen],
  )

  const pick = useCallback(
    (type: NodeTypeId) => {
      const nodeId = addAndSelect(type, placementRef.current)
      if (nodeId !== null) focusOnCloseRef.current = { kind: 'new-node', nodeId }
      setIsOpen(false)
    },
    [setIsOpen],
  )

  const addNodeAt = useCallback<AddNodeAt>(
    (type, origin) => addAndSelect(type, resolvePlacement(origin)),
    [resolvePlacement],
  )

  const restoreFocus = useCallback(() => {
    if (isOverlayReplaced(overlayId)) return
    const target = focusOnCloseRef.current
    if (target.kind === 'new-node') focusFlowNode(target.nodeId)
    else focusOpenerOrCanvas(target.element)
  }, [overlayId])

  useAddNodeShortcut(openMenu)

  const api = useMemo<AddNodeMenuApi>(() => ({ openMenu, addNodeAt }), [openMenu, addNodeAt])

  return (
    <AddNodeMenuContext value={api}>
      {children}
      <AddNodeMenu
        open={isOpen}
        onOpenChange={setIsOpen}
        onPick={pick}
        restoreFocus={restoreFocus}
      />
    </AddNodeMenuContext>
  )
}
