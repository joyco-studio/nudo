import type { ReactElement } from 'react'
import { asEdgeId } from '@nudo-tsl/core'

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'

import { CanvasMenuContent } from './canvas-menu-content'
import { useGraphCanvasActions } from './graph-canvas-actions'
import { CONTEXT_MENU_TRIGGER_PROPS } from './open-context-menu'
import { useAfterMenuClose } from './use-after-menu-close'

interface EdgeContextMenuProps {
  edgeId: string
  /** The edge's group of paths: the element a right-click opens the menu on. */
  children: ReactElement
}

/** A connection's right-click menu (also the ContextMenu key or Shift+F10 on a focused edge). */
export function EdgeContextMenu({ edgeId, children }: EdgeContextMenuProps) {
  const { deleteEdge } = useGraphCanvasActions()
  const afterClose = useAfterMenuClose()

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild {...CONTEXT_MENU_TRIGGER_PROPS}>
        {children}
      </ContextMenuTrigger>
      <CanvasMenuContent onCloseAutoFocus={afterClose.onCloseAutoFocus}>
        <ContextMenuItem
          variant="destructive"
          onSelect={() => {
            afterClose.runAfterClose(() => {
              deleteEdge(asEdgeId(edgeId))
            })
          }}
        >
          Delete connection
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </CanvasMenuContent>
    </ContextMenu>
  )
}
