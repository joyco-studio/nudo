import type { ReactElement } from 'react'
import { asEdgeId } from '@nudo-tsl/core'
import type { XY } from '@nudo-tsl/core'

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'
import { useT } from '@/i18n/use-t'

import { CanvasMenuContent } from './canvas-menu-content'
import { useGraphCanvasActions } from './graph-canvas-actions'
import { CONTEXT_MENU_TRIGGER_PROPS, ignoreForeignContextMenu } from './open-context-menu'
import { useCanvasMenu } from './use-canvas-menu'

interface EdgeContextMenuProps {
  edgeId: string
  /** The middle of the connection's curve, in flow units: where an inserted reroute goes. */
  midpoint: XY
  /** False for a value a reroute can't carry (a texture): the menu leaves the item out. */
  canInsertReroute: boolean
  /** The edge's group of paths: the element a right-click opens the menu on. */
  children: ReactElement
}

/**
 * A connection's right-click menu (also the ContextMenu key or Shift+F10 on a focused edge): insert
 * a reroute (the keyboard's way to do what a double click does) or delete it.
 */
export function EdgeContextMenu({
  edgeId,
  midpoint,
  canInsertReroute,
  children,
}: EdgeContextMenuProps) {
  const { deleteEdge, insertRerouteAt } = useGraphCanvasActions()
  const menu = useCanvasMenu()
  const t = useT()

  return (
    <ContextMenu onOpenChange={menu.onOpenChange}>
      <ContextMenuTrigger
        asChild
        {...CONTEXT_MENU_TRIGGER_PROPS}
        onContextMenuCapture={ignoreForeignContextMenu}
      >
        {children}
      </ContextMenuTrigger>
      <CanvasMenuContent onCloseAutoFocus={menu.onCloseAutoFocus}>
        {canInsertReroute && (
          <>
            <ContextMenuItem
              onSelect={() => {
                menu.runAfterClose(() => {
                  insertRerouteAt(asEdgeId(edgeId), midpoint)
                })
              }}
            >
              {t('edge.insertReroute')}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          variant="destructive"
          onSelect={() => {
            menu.runAfterClose(() => {
              deleteEdge(asEdgeId(edgeId))
            })
          }}
        >
          {t('edge.delete')}
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </CanvasMenuContent>
    </ContextMenu>
  )
}
