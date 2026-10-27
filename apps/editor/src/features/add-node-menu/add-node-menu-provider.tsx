import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { NodeId, NodeTypeId, XY } from '@nudo-tsl/core'

import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { focusOpenerOrCanvas } from '@/shared/lib/focus-opener'
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
import { useNodePlacement } from './use-node-placement'
import { useAddNodeShortcut } from './use-add-node-shortcut'

/** Where focus goes when the menu closes: the node just added, or whatever opened the menu. */
type FocusOnClose =
  | { readonly kind: 'new-node'; readonly nodeId: NodeId }
  | { readonly kind: 'opener'; readonly element: HTMLElement | null }

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
  const resolvePlacement = useNodePlacement()
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
