import { useEffect } from 'react'
import type { NodeId } from '@nudo-tsl/core'
import { useReactFlow } from '@xyflow/react'

import { flowNodeIdOf, resolveActionNodeIds } from '@/features/canvas/canvas-keyboard-model'
import { fitViewOptionsFor } from '@/features/canvas/fit-view-options'
import { redo, undo, useEditorStore } from '@/store/editor-store'

import { copySelection, pasteFromClipboard } from './clipboard'
import { globalShortcutAction } from './shortcut-action'
import type { GlobalShortcutAction } from './shortcut-action'
import { useOpenShortcutsDialog } from './shortcuts-dialog-context'

/** Text fields keep their own undo, copy and paste, so shortcuts never fire while typing. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/** Dialogs and popovers own the keyboard while they are open. */
function isInsideOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OVERLAY_SELECTOR) !== null
}

function hasSelectedText(): boolean {
  return (window.getSelection()?.toString() ?? '') !== ''
}

const getStore = () => useEditorStore.getState()

function selectAllNodes(): void {
  const store = getStore()
  store.setSelection(Object.values(store.graph.nodes).map((node) => node.id))
}

function copyTargetNodes(target: EventTarget | null): readonly NodeId[] {
  return resolveActionNodeIds(flowNodeIdOf(target), getStore().selectedNodeIds)
}

/**
 * Editor-wide keyboard shortcuts: undo and redo, copy and paste, select all, fit view and the
 * shortcuts dialog. Mounted once, inside the React Flow provider.
 */
export function useGlobalShortcuts(): void {
  const { fitView } = useReactFlow()
  const openShortcutsDialog = useOpenShortcutsDialog()

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
      }
    }

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
  }, [fitView, openShortcutsDialog])
}
