import { useRef } from 'react'
import type { ReactElement } from 'react'

import { useRunCommand } from '@/features/command-palette/command-context'
import { UNTARGETED } from '@/features/command-palette/command-registry'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'

import { CanvasMenuContent } from './canvas-menu-content'
import { CommandMenuLabel } from './command-menu-label'
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
 * The empty canvas's right-click menu: add a node or a comment, paste, select all, or fit the
 * view. Anything added or pasted lands where the menu was opened, so those items keep their own
 * placement; their names and keys, and the rest of the items, come from the command registry.
 * The ContextMenu key or Shift+F10 on the focused canvas opens it in the middle of the view.
 */
export function PaneContextMenu({ children }: PaneContextMenuProps) {
  const actions = useGraphCanvasActions()
  const runCommand = useRunCommand()
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
          <CommandMenuLabel commandId="add-node" />
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            runAtMenuPoint(actions.pasteAt)
          }}
        >
          <CommandMenuLabel commandId="paste" />
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            runAtMenuPoint(actions.addCommentAt)
          }}
        >
          <CommandMenuLabel commandId="add-comment" />
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            runCommand('select-all', UNTARGETED)
          }}
        >
          <CommandMenuLabel commandId="select-all" />
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            runCommand('fit-view', UNTARGETED)
          }}
        >
          <CommandMenuLabel commandId="fit-view" />
        </ContextMenuItem>
      </CanvasMenuContent>
    </ContextMenu>
  )
}
