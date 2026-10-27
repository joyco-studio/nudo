import type { ReactElement } from 'react'
import { MASTER_NODE_ID, UNIVERSAL_PARAMS } from '@nudo-tsl/core'

import { useRunCommand } from '@/features/command-palette/command-context'
import type { CommandInvocation } from '@/features/command-palette/command-registry'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'

import { CanvasMenuContent } from './canvas-menu-content'
import { CommandMenuLabel } from './command-menu-label'
import { useGraphCanvasActions } from './graph-canvas-actions'
import {
  COLLAPSED_PARAM,
  PREVIEW_MODE_PARAM,
  isNodeCollapsed,
  portsToggleLabel,
} from './node-port-layout'
import { isEnumParam } from './param-kinds'
import { CONTEXT_MENU_TRIGGER_PROPS, ignoreForeignContextMenu } from './open-context-menu'
import { COMMENT_TYPE } from './to-flow'
import type { FlowNodeData } from './to-flow'
import { useCanvasMenu } from './use-canvas-menu'

/** Auto / 2D / 3D, read from the universal param so the menu and the graph never disagree. */
const PREVIEW_MODE = UNIVERSAL_PARAMS.find((param) => param.id === PREVIEW_MODE_PARAM)
const PREVIEW_MODE_PARAM_DEFINITION = isEnumParam(PREVIEW_MODE) ? PREVIEW_MODE : null

interface NodeMenuModel {
  /** Copy, Duplicate and Delete: never the master, which can't be copied or removed. */
  canCopyOrRemove: boolean
  canTogglePorts: boolean
  canSetPreviewMode: boolean
}

function nodeMenuModel(data: FlowNodeData): NodeMenuModel {
  const { node, definition } = data
  const isComment = node.type === COMMENT_TYPE
  const isPill = definition.reads === 'property'
  const hasPorts = definition.inputs.length + definition.outputs.length > 0
  return {
    canCopyOrRemove: node.id !== MASTER_NODE_ID,
    canTogglePorts: !isComment && !isPill && hasPorts,
    canSetPreviewMode: !isComment && !isPill && PREVIEW_MODE_PARAM_DEFINITION !== null,
  }
}

interface NodeContextMenuProps {
  data: FlowNodeData
  /** The node's frame: the element a right-click (or the keyboard path) opens the menu on. */
  children: ReactElement
}

/**
 * A node's right-click menu: Copy, Duplicate, collapse its ports, its preview mode and Delete. The
 * ContextMenu key or Shift+F10 on the focused node opens it too (see the canvas keyboard model).
 * Copy, Duplicate and Delete run the registry commands on this node, so they act on the node, or
 * on the selection when it holds the node.
 */
export function NodeContextMenu({ data, children }: NodeContextMenuProps) {
  const actions = useGraphCanvasActions()
  const runCommand = useRunCommand()
  const menu = useCanvasMenu()
  // The menu's own node, named explicitly: the commands act on it, or on the selection holding it.
  // No opener: the menu restores focus itself.
  const target: CommandInvocation = { opener: null, nodeId: data.node.id }
  const { node } = data
  const model = nodeMenuModel(data)
  const isCollapsed = isNodeCollapsed(data)
  const storedMode = node.params[PREVIEW_MODE_PARAM]
  const previewMode =
    typeof storedMode === 'string' ? storedMode : (PREVIEW_MODE_PARAM_DEFINITION?.default ?? '')

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
        {model.canCopyOrRemove && (
          <>
            <ContextMenuItem
              onSelect={() => {
                runCommand('copy', target)
              }}
            >
              <CommandMenuLabel commandId="copy" />
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                menu.runAfterClose(() => {
                  runCommand('duplicate', target)
                })
              }}
            >
              <CommandMenuLabel commandId="duplicate" />
            </ContextMenuItem>
          </>
        )}
        {model.canTogglePorts && (
          <ContextMenuItem
            onSelect={() => {
              actions.setParam({ nodeId: node.id, paramId: COLLAPSED_PARAM }, !isCollapsed)
            }}
          >
            {portsToggleLabel(isCollapsed)}
          </ContextMenuItem>
        )}
        {model.canSetPreviewMode && PREVIEW_MODE_PARAM_DEFINITION !== null && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>{PREVIEW_MODE_PARAM_DEFINITION.label}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="min-w-32">
              <ContextMenuRadioGroup
                value={previewMode}
                onValueChange={(value) => {
                  actions.setParam({ nodeId: node.id, paramId: PREVIEW_MODE_PARAM }, value)
                }}
              >
                {PREVIEW_MODE_PARAM_DEFINITION.options.map((option) => (
                  <ContextMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {model.canCopyOrRemove && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onSelect={() => {
                menu.runAfterClose(() => {
                  runCommand('delete', target)
                })
              }}
            >
              <CommandMenuLabel commandId="delete" />
              {/* The canvas's Delete key, which the command (it has no key of its own) mirrors. */}
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </CanvasMenuContent>
    </ContextMenu>
  )
}
