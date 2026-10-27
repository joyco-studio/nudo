import { useEffect } from 'react'

import { useRunCommand } from '@/features/command-palette/command-context'
import { invocationFrom, panelCommandId } from '@/features/command-palette/command-registry'
import { htmlElementOf } from '@/shared/lib/html-element-of'
import { isInsideOverlay } from '@/shared/lib/is-inside-overlay'
import { isTextEntry } from '@/shared/lib/is-text-entry'
import { useEditorStore } from '@/store/editor-store'

import { isPanelShortcutTarget, panelShortcutAction } from './panel-shortcut-action'
import { effectivePreviewLayout } from './panel-state'

const getStore = () => useEditorStore.getState()

/**
 * Escape leaves the full preview, unless a dialog, menu or field owns the key. Checked in the
 * capture phase, so a tooltip that Escape also closes (on a focused header control) does not
 * swallow it.
 */
function isLeaveFullPress(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) return false
  if (isTextEntry(event.target) || isInsideOverlay(event.target)) return false
  // A collapsed preview shows docked, whatever its stored layout: there is no full view to leave.
  return effectivePreviewLayout(getStore().panels) === 'full'
}

/**
 * Panel keys: B, I, P and C toggle the Blackboard, Inspector, Preview and Code panels, and
 * Shift+P cycles the preview layout, while focus is on the canvas, a node or a panel header. Each
 * runs its registry command. Escape leaves the full preview. Mounted once, inside the command
 * provider.
 */
export function usePanelShortcuts(): void {
  const runCommand = useRunCommand()

  useEffect(() => {
    const onKeyDownCapture = (event: KeyboardEvent): void => {
      if (!isLeaveFullPress(event)) return
      getStore().exitFullPreview()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || !isPanelShortcutTarget(event.target)) return
      const action = panelShortcutAction(event)
      if (action === null) return
      event.preventDefault()
      runCommand(panelCommandId(action), invocationFrom(htmlElementOf(event.target)))
    }
    window.addEventListener('keydown', onKeyDownCapture, { capture: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDownCapture, { capture: true })
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [runCommand])
}
