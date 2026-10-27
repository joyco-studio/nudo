import { useEffect } from 'react'
import type { NodeId } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { flowNodeIdOf, resolveActionNodeIds } from '@/features/canvas/canvas-keyboard-model'
import { fitViewOptionsFor } from '@/features/canvas/fit-view-options'
import { selectAllNodes } from '@/features/canvas/node-commands'
import { useRequestNewGraph } from '@/features/new-graph/new-graph-context'
import { isInsideOverlay } from '@/shared/lib/is-inside-overlay'
import { isTextEntry } from '@/shared/lib/is-text-entry'
import { redo, undo, useEditorStore } from '@/store/editor-store'

import { copySelection, pasteFromClipboard } from './clipboard'
import { globalShortcutAction } from './shortcut-action'
import type { GlobalShortcutAction } from './shortcut-action'
import { useOpenShortcutsDialog } from './shortcuts-dialog-context'

function hasSelectedText(): boolean {
  return (window.getSelection()?.toString() ?? '') !== ''
}

const getStore = () => useEditorStore.getState()

function copyTargetNodes(target: EventTarget | null): readonly NodeId[] {
  return resolveActionNodeIds(flowNodeIdOf(target), getStore().selectedNodeIds)
}

/**
 * Editor-wide keyboard shortcuts: undo and redo, copy and paste, select all, fit view, new graph
 * and the shortcuts dialog. Mounted once, inside the React Flow provider.
 */
export function useGlobalShortcuts(): void {
  const { fitView } = useReactFlow()
  const openShortcutsDialog = useOpenShortcutsDialog()
  const requestNewGraph = useRequestNewGraph()

  useEffect(() => {
    const run = (action: GlobalShortcutAction, event: KeyboardEvent): void => {
      switch (action) {
        case 'undo':
          undo()
          return
        case 'redo':
          redo()
          return
        case 'copy':
          void copySelection(copyTargetNodes(event.target))
          return
        case 'paste':
          void pasteFromClipboard()
          return
        case 'select-all':
          selectAllNodes()
          return
        case 'fit-view':
          void fitView(fitViewOptionsFor(window.innerWidth))
          return
        case 'show-shortcuts':
          openShortcutsDialog(event.target instanceof HTMLElement ? event.target : null)
          return
        case 'new-graph':
          requestNewGraph(event.target instanceof HTMLElement ? event.target : null)
          return
      }
    }

    // Text fields keep their own undo, copy and paste, so shortcuts never fire while typing.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || isTextEntry(event.target) || isInsideOverlay(event.target)) {
        return
      }
      const action = globalShortcutAction(event)
      if (action === null) return
      // Let the browser copy selected page text; there is nothing for us to copy then.
      if (action === 'copy' && hasSelectedText()) return
      event.preventDefault()
      run(action, event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [fitView, openShortcutsDialog, requestNewGraph])
}
