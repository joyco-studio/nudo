import type { ReactElement } from 'react'
import {
  COLLAPSED_PARAM,
  MASTER_NODE_ID,
  PREVIEW_MODE_PARAM,
  SHOW_PREVIEW_PARAM,
  UNIVERSAL_PARAMS,
} from '@nudo-tsl/core'
import type { NodeId } from '@nudo-tsl/core'
import { commentNode, rerouteNode } from '@nudo-tsl/nodes'

import { useRunCommand } from '@/features/command-palette/command-context'
import { MIN_TIDY_SELECTION } from '@/features/command-palette/command-registry'
import { hasNodePreview, isPreviewShown } from '@/features/node-previews/preview-graph'
import { previewToggleAction } from '@/features/node-previews/preview-toggle'
import { useUniversalParam } from '@/i18n/use-node-registry'
import { useT } from '@/i18n/use-t'
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
import { useEditorStore } from '@/store/editor-store'

import { CanvasMenuContent } from './canvas-menu-content'
import { CommandMenuLabel } from './command-menu-label'
import { useGraphCanvasActions } from './graph-canvas-actions'
import { isNodeCollapsed, portsToggleLabel } from './node-port-layout'
import { isEnumParam } from './param-kinds'
import { CONTEXT_MENU_TRIGGER_PROPS, ignoreForeignContextMenu } from './open-context-menu'
import type { FlowNodeData } from './to-flow'
import { useCanvasMenu } from './use-canvas-menu'
import type { CanvasMenu } from './use-canvas-menu'

/** Auto / 2D / 3D, read from the universal param so the menu and the graph never disagree. */
const PREVIEW_MODE = UNIVERSAL_PARAMS.find((param) => param.id === PREVIEW_MODE_PARAM)
const PREVIEW_MODE_PARAM_DEFINITION = isEnumParam(PREVIEW_MODE) ? PREVIEW_MODE : null

/** The preview mode param, named in the UI language. */
function PreviewModeSub({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const param = useUniversalParam(PREVIEW_MODE)
  if (!isEnumParam(param)) return null
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>{param.label}</ContextMenuSubTrigger>
      <ContextMenuSubContent className="min-w-32">
        <ContextMenuRadioGroup value={value} onValueChange={onChange}>
          {param.options.map((option) => (
            <ContextMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}

interface NodeMenuModel {
  /** Copy, Duplicate and Delete: never the master, which can't be copied or removed. */
  canCopyOrRemove: boolean
  canTogglePorts: boolean
  /** Show or hide the preview, and pick its mode: only nodes that have a preview. */
  hasPreview: boolean
}

function nodeMenuModel(data: FlowNodeData): NodeMenuModel {
  const { node, definition } = data
  const isComment = node.type === commentNode.type
  const isPill = definition.reads === 'property'
  const isReroute = node.type === rerouteNode.type
  const hasPorts = definition.inputs.length + definition.outputs.length > 0
  // Comments, property pills and reroutes have no port list to fold.
  const isCard = !isComment && !isPill && !isReroute
  return {
    canCopyOrRemove: node.id !== MASTER_NODE_ID,
    canTogglePorts: isCard && hasPorts,
    hasPreview: hasNodePreview(node, definition),
  }
}

/**
 * "Tidy up selection", while the selection holds this node and something else to arrange. Read
 * only while the menu is open, so selecting nodes never re-renders every node's menu.
 */
function TidySelectionItem({ nodeId, menu }: { nodeId: NodeId; menu: CanvasMenu }) {
  const runCommand = useRunCommand()
  const selected = useEditorStore((state) => state.selectedNodeIds)
  if (!selected.includes(nodeId) || selected.length < MIN_TIDY_SELECTION) return null
  return (
    <ContextMenuItem
      onSelect={() => {
        menu.runAfterClose(() => {
          runCommand('tidy-up-selection', { opener: null, nodeId })
        })
      }}
    >
      <CommandMenuLabel commandId="tidy-up-selection" />
    </ContextMenuItem>
  )
}

interface NodeContextMenuProps {
  data: FlowNodeData
  /** The node's frame: the element a right-click (or the keyboard path) opens the menu on. */
  children: ReactElement
}

/**
 * A node's right-click menu: Copy, Duplicate, collapse its ports, show or hide its preview, its
 * preview mode and Delete. The ContextMenu key or Shift+F10 on the focused node opens it too (see
 * the canvas keyboard model).
 * Copy, Duplicate and Delete run the registry commands on this node, so they act on the node, or
 * on the selection when it holds the node.
 */
export function NodeContextMenu({ data, children }: NodeContextMenuProps) {
  const actions = useGraphCanvasActions()
  const runCommand = useRunCommand()
  const menu = useCanvasMenu()
  const t = useT()
  // The menu's own node, named explicitly: the commands act on it, or on the selection holding it.
  // No opener: the menu restores focus itself.
  const target: CommandInvocation = { opener: null, nodeId: data.node.id }
  const { node } = data
  const model = nodeMenuModel(data)
  const isCollapsed = isNodeCollapsed(data)
  const isShown = isPreviewShown(node)
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
        <TidySelectionItem nodeId={node.id} menu={menu} />
        {model.canTogglePorts && (
          <ContextMenuItem
            onSelect={() => {
              actions.setParam({ nodeId: node.id, paramId: COLLAPSED_PARAM }, !isCollapsed)
            }}
          >
            {t(portsToggleLabel(isCollapsed))}
          </ContextMenuItem>
        )}
        {model.hasPreview && (
          <ContextMenuItem
            onSelect={() => {
              actions.setParam({ nodeId: node.id, paramId: SHOW_PREVIEW_PARAM }, !isShown)
            }}
          >
            {t(previewToggleAction(isShown))}
          </ContextMenuItem>
        )}
        {model.hasPreview && (
          <PreviewModeSub
            value={previewMode}
            onChange={(value) => {
              actions.setParam({ nodeId: node.id, paramId: PREVIEW_MODE_PARAM }, value)
            }}
          />
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
