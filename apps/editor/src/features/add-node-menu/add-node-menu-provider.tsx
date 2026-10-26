import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { NodeId, NodeTypeId, XY } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useEditorStore } from '@/store/editor-store'

import { AddNodeMenu } from './add-node-menu'
import { AddNodeMenuContext } from './add-node-menu-context'
import type { OpenAddNodeMenu } from './add-node-menu-context'
import { besideNode, rectCenter } from './add-node-placement'
import type { PlacementOrigin } from './add-node-placement'
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

function focusOpener(element: HTMLElement | null): void {
  const target = element?.isConnected === true ? element : canvasElement()
  target?.focus({ preventScroll: true })
}

interface AddNodeMenuProviderProps {
  children: ReactNode
}

/**
 * Owns the add-node menu: opening it (Space, header button, pane right-click), placing the picked
 * node, and moving focus afterwards. Must sit inside a `ReactFlowProvider`.
 */
export function AddNodeMenuProvider({ children }: AddNodeMenuProviderProps) {
  const { screenToFlowPosition } = useReactFlow()
  const [isOpen, setIsOpen] = useState(false)
  const placementRef = useRef<XY>({ x: 0, y: 0 })
  const focusOnCloseRef = useRef<FocusOnClose>({ kind: 'opener', element: null })

  const resolvePlacement = useCallback(
    (origin: PlacementOrigin): XY => {
      if (origin.kind === 'cursor') {
        return screenToFlowPosition({ x: origin.clientX, y: origin.clientY })
      }
      if (origin.kind === 'beside-node') {
        const node = useEditorStore.getState().graph.nodes[origin.nodeId]
        if (node !== undefined) return besideNode(node.position)
      }
      return screenToFlowPosition(viewportCenter())
    },
    [screenToFlowPosition],
  )

  const openMenu = useCallback<OpenAddNodeMenu>(
    (origin, opener) => {
      placementRef.current = resolvePlacement(origin)
      focusOnCloseRef.current = { kind: 'opener', element: opener }
      setIsOpen(true)
    },
    [resolvePlacement],
  )

  const pick = useCallback((type: NodeTypeId) => {
    const store = useEditorStore.getState()
    const nodeId = store.addNode(type, placementRef.current)
    if (nodeId !== null) {
      store.setSelection([nodeId])
      focusOnCloseRef.current = { kind: 'new-node', nodeId }
    }
    setIsOpen(false)
  }, [])

  const restoreFocus = useCallback(() => {
    const target = focusOnCloseRef.current
    if (target.kind === 'new-node') focusFlowNode(target.nodeId)
    else focusOpener(target.element)
  }, [])

  useAddNodeShortcut(openMenu)

  return (
    <AddNodeMenuContext value={openMenu}>
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
