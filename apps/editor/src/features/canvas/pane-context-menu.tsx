import { useRef } from 'react'
import type { ReactElement } from 'react'

import { MOD } from '@/features/shortcuts/shortcut-catalog'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'

import { CanvasMenuContent } from './canvas-menu-content'
import { useGraphCanvasActions } from './graph-canvas-actions'
import type { ClientPoint } from './graph-canvas-actions'
import { ignoreForeignContextMenu } from './open-context-menu'
import { useCanvasMenu } from './use-canvas-menu'

/** Parts of the canvas that are not empty space: they have their own menu, or none. */
const NOT_EMPTY_CANVAS_SELECTOR = [
  '.react-flow__node',
  '.react-flow__edge',
  '.react-flow__edgelabel-renderer',
  '.react-flow__nodesselection',
  '.react-flow__panel',
].join(', ')

function isEmptyCanvas(target: EventTarget): boolean {
  return target instanceof Element && target.closest(NOT_EMPTY_CANVAS_SELECTOR) === null
}

interface PaneContextMenuProps {
  /** The React Flow root: a right-click on its empty space opens this menu. */
  children: ReactElement
}

/**
 * The empty canvas's right-click menu: add a node or a comment, paste, select all, or fit the view. Anything
 * added or pasted lands where the menu was opened. The ContextMenu key or Shift+F10 on the
 * focused canvas opens it in the middle of the view.
 */
export function PaneContextMenu({ children }: PaneContextMenuProps) {
  const actions = useGraphCanvasActions()
  const menu = useCanvasMenu()
  const openedAtRef = useRef<ClientPoint>({ clientX: 0, clientY: 0 })

  /** Runs once the menu has closed, at the point where it was opened. */
  const runAtMenuPoint = (task: (point: ClientPoint) => void): void => {
    const point = openedAtRef.current
    menu.runAfterClose(() => {
      task(point)
    })
  }

  return (
    <ContextMenu onOpenChange={menu.onOpenChange}>
      <ContextMenuTrigger
        asChild
        onContextMenuCapture={ignoreForeignContextMenu}
        onContextMenu={(event) => {
          // A node or edge already opened its own menu; controls and labels get none.
          if (!isEmptyCanvas(event.target)) {
            event.preventDefault()
            return
          }
          openedAtRef.current = { clientX: event.clientX, clientY: event.clientY }
        }}
      >
        {children}
      </ContextMenuTrigger>
      <CanvasMenuContent onCloseAutoFocus={menu.onCloseAutoFocus}>
        <ContextMenuItem
          onSelect={() => {
            runAtMenuPoint(actions.openAddNodeMenuAt)
          }}
        >
          Add node…
          <ContextMenuShortcut>Space</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            runAtMenuPoint(actions.pasteAt)
          }}
        >
          Paste
          <ContextMenuShortcut>{MOD} V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            runAtMenuPoint(actions.addCommentAt)
          }}
        >
          Add comment
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={actions.selectAll}>
          Select all
          <ContextMenuShortcut>{MOD} A</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={actions.fitView}>
          Fit view
          <ContextMenuShortcut>F</ContextMenuShortcut>
        </ContextMenuItem>
      </CanvasMenuContent>
    </ContextMenu>
  )
}
