import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { NodeId } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { useAddNodeAt, useOpenAddNodeMenu } from '@/features/add-node-menu/add-node-menu-context'
import { focusFlowNode } from '@/features/canvas/focus-flow-node'
import type { FlowNode } from '@/features/canvas/to-flow'
import { useTidyUp } from '@/features/canvas/tidy-up/use-tidy-up'
import { usePanelAwareView } from '@/features/canvas/use-panel-aware-view'
import { useRequestNewGraph } from '@/features/new-graph/new-graph-context'
import { useOpenShortcutsDialog } from '@/features/shortcuts/shortcuts-dialog-context'
import type { Locale } from '@/i18n/locale'
import { useEditorStore } from '@/store/editor-store'

import { CommandsContext } from './command-context'
import type { CommandsApi, RunCommand } from './command-context'
import { CommandPalette } from './command-palette'
import { findCommand, invocationFrom, placementNear } from './command-registry'
import type { CommandServices } from './command-registry'
import type { PaletteItem } from './palette-results'
import { useCommandPalette } from './use-command-palette'

interface CommandPaletteProviderProps {
  /** The theme lives above the editor providers; the app passes its switch in. */
  toggleTheme: () => void
  /** So does the language. */
  setLocale: (locale: Locale) => void
  children: ReactNode
}

/**
 * Runs registry commands for the keyboard, the context menus and the palette, and owns the palette
 * itself. Must sit inside the React Flow, add-node menu, shortcuts dialog and new-graph providers.
 */
export function CommandPaletteProvider({
  toggleTheme,
  setLocale,
  children,
}: CommandPaletteProviderProps) {
  const { getNode } = useReactFlow<FlowNode>()
  const view = usePanelAwareView()
  const tidyUp = useTidyUp()
  const openShortcutsDialog = useOpenShortcutsDialog()
  const requestNewGraph = useRequestNewGraph()
  const openAddNodeMenu = useOpenAddNodeMenu()
  const addNodeAt = useAddNodeAt()
  const palette = useCommandPalette()
  const { open: openCommandPalette, closeThenRun } = palette

  const services = useMemo<CommandServices>(
    () => ({
      fitView: view.fitAll,
      frameNodes: view.frameNodes,
      tidyUp,
      toggleTheme,
      setLocale,
      openShortcutsDialog,
      requestNewGraph,
      openAddNodeMenu,
      addNode: addNodeAt,
      openCommandPalette,
    }),
    [
      view,
      tidyUp,
      toggleTheme,
      setLocale,
      openShortcutsDialog,
      requestNewGraph,
      openAddNodeMenu,
      addNodeAt,
      openCommandPalette,
    ],
  )

  const runCommand = useCallback<RunCommand>(
    (id, invocation) => {
      findCommand(id)?.run({ ...invocation, services })
    },
    [services],
  )

  /**
   * Brings a node to the middle of the canvas the panels leave uncovered, at the current zoom,
   * selects it and focuses it.
   */
  const revealNode = useCallback(
    (nodeId: NodeId) => {
      const node = getNode(nodeId)
      if (node !== undefined) {
        const width = node.measured?.width ?? 0
        const height = node.measured?.height ?? 0
        view.centerOn({ x: node.position.x + width / 2, y: node.position.y + height / 2 })
      }
      useEditorStore.getState().setSelection([nodeId])
      focusFlowNode(nodeId)
    },
    [getNode, view],
  )

  const runItem = useCallback(
    (item: PaletteItem) => {
      closeThenRun((opener) => {
        const invocation = invocationFrom(opener)
        if (item.kind === 'command') {
          item.command.run({ ...invocation, services })
        } else if (item.kind === 'jump') {
          revealNode(item.nodeId)
        } else {
          const nodeId = addNodeAt(item.type, placementNear(invocation.nodeId))
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
