import type { ReactElement } from 'react'
import { MASTER_NODE_ID, UNIVERSAL_PARAMS } from '@nudo-tsl/core'
import type { ParamDefinition } from '@nudo-tsl/core'

import { MOD } from '@/features/shortcuts/shortcut-catalog'
import { isTextEntry } from '@/shared/lib/is-text-entry'
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
import { useGraphCanvasActions } from './graph-canvas-actions'
import {
  COLLAPSED_PARAM,
  PREVIEW_MODE_PARAM,
  isNodeCollapsed,
  portsToggleLabel,
} from './node-port-layout'
import { CONTEXT_MENU_TRIGGER_PROPS } from './open-context-menu'
import { COMMENT_TYPE } from './to-flow'
import type { FlowNodeData } from './to-flow'
import { useAfterMenuClose } from './use-after-menu-close'

type EnumParam = Extract<ParamDefinition, { kind: 'enum' }>

function isEnumParam(param: ParamDefinition | undefined): param is EnumParam {
  return param?.kind === 'enum'
}

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
 * A right-click in a text field keeps the browser's menu, for its own cut, copy and paste.
 */
export function NodeContextMenu({ data, children }: NodeContextMenuProps) {
  const actions = useGraphCanvasActions()
  const afterClose = useAfterMenuClose()
  const { node } = data
  const model = nodeMenuModel(data)
  const isCollapsed = isNodeCollapsed(data)
  const storedMode = node.params[PREVIEW_MODE_PARAM]
  const previewMode =
    typeof storedMode === 'string' ? storedMode : (PREVIEW_MODE_PARAM_DEFINITION?.default ?? '')

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        {...CONTEXT_MENU_TRIGGER_PROPS}
        onContextMenuCapture={(event) => {
          if (isTextEntry(event.target)) event.stopPropagation()
        }}
      >
        {children}
      </ContextMenuTrigger>
      <CanvasMenuContent onCloseAutoFocus={afterClose.onCloseAutoFocus}>
        {model.canCopyOrRemove && (
          <>
            <ContextMenuItem
              onSelect={() => {
                actions.copyNodes(actions.commandTargets(node.id))
              }}
            >
              Copy
              <ContextMenuShortcut>{MOD} C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const targets = actions.commandTargets(node.id)
                afterClose.runAfterClose(() => {
                  actions.duplicateNodes(targets)
                })
              }}
            >
              Duplicate
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
                const targets = actions.commandTargets(node.id)
                afterClose.runAfterClose(() => {
                  actions.deleteNodes(targets)
                })
              }}
            >
              Delete
              <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </CanvasMenuContent>
    </ContextMenu>
  )
}
