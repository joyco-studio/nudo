import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { NodeId } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { useAddNodeAt, useOpenAddNodeMenu } from '@/features/add-node-menu/add-node-menu-context'
import { fitViewOptionsFor } from '@/features/canvas/fit-view-options'
import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import type { FlowNode } from '@/features/canvas/to-flow'
import { useRequestNewGraph } from '@/features/new-graph/new-graph-context'
import { useOpenShortcutsDialog } from '@/features/shortcuts/shortcuts-dialog-context'
import { useEditorStore } from '@/store/editor-store'

import { CommandsContext } from './command-context'
import type { CommandsApi, RunCommand } from './command-context'
import { CommandPalette } from './command-palette'
import { findCommand, placementNear } from './command-registry'
import type { CommandServices } from './command-registry'
import type { PaletteItem } from './palette-results'
import { useCommandPalette } from './use-command-palette'

interface CommandPaletteProviderProps {
  /** The theme lives above the editor providers; the app passes its switch in. */
  toggleTheme: () => void
  children: ReactNode
}

/**
 * Runs registry commands for the keyboard, the context menus and the palette, and owns the palette
 * itself. Must sit inside the React Flow, add-node menu, shortcuts dialog and new-graph providers.
 */
export function CommandPaletteProvider({ toggleTheme, children }: CommandPaletteProviderProps) {
  const { fitView, getNode, getZoom, setCenter } = useReactFlow<FlowNode>()
  const openShortcutsDialog = useOpenShortcutsDialog()
  const requestNewGraph = useRequestNewGraph()
  const openAddNodeMenu = useOpenAddNodeMenu()
  const addNodeAt = useAddNodeAt()
  const palette = useCommandPalette()
  const { open: openCommandPalette, closeThenRun } = palette

  const services = useMemo<CommandServices>(
    () => ({
      fitView: () => {
        void fitView(fitViewOptionsFor(window.innerWidth))
      },
      toggleTheme,
      openShortcutsDialog,
      requestNewGraph,
      openAddNodeMenu,
      addNode: addNodeAt,
      openCommandPalette,
    }),
    [
      fitView,
      toggleTheme,
      openShortcutsDialog,
      requestNewGraph,
      openAddNodeMenu,
      addNodeAt,
      openCommandPalette,
    ],
  )

  const runCommand = useCallback<RunCommand>(
    (id, opener) => {
      findCommand(id)?.run({ opener, services })
    },
    [services],
  )

  /** Brings a node to the middle of the view at the current zoom, selects it and focuses it. */
  const revealNode = useCallback(
    (nodeId: NodeId) => {
      const node = getNode(nodeId)
      if (node !== undefined) {
        const width = node.measured?.width ?? 0
        const height = node.measured?.height ?? 0
        void setCenter(node.position.x + width / 2, node.position.y + height / 2, {
          zoom: getZoom(),
        })
      }
      useEditorStore.getState().setSelection([nodeId])
      focusFlowNode(nodeId)
    },
    [getNode, getZoom, setCenter],
  )

  const runItem = useCallback(
    (item: PaletteItem) => {
      closeThenRun((opener) => {
        if (item.kind === 'command') {
          item.command.run({ opener, services })
        } else if (item.kind === 'jump') {
          revealNode(item.nodeId)
        } else {
          const nodeId = addNodeAt(item.type, placementNear(opener))
          if (nodeId !== null) focusFlowNode(nodeId)
        }
      })
    },
    [closeThenRun, services, revealNode, addNodeAt],
  )

  const api = useMemo<CommandsApi>(
    () => ({ runCommand, openCommandPalette }),
    [runCommand, openCommandPalette],
  )

  return (
    <CommandsContext value={api}>
      {children}
      <CommandPalette
        open={palette.isOpen}
        onOpenChange={palette.onOpenChange}
        onCloseAutoFocus={palette.onCloseAutoFocus}
        opener={palette.opener}
        onRun={runItem}
      />
    </CommandsContext>
  )
}
