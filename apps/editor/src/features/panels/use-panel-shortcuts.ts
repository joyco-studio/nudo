import { useEffect } from 'react'

import { isInsideOverlay } from '@/shared/lib/is-inside-overlay'
import { isTextEntry } from '@/shared/lib/is-text-entry'
import { useEditorStore } from '@/store/editor-store'

import { isPanelShortcutTarget, panelShortcutAction } from './panel-shortcut-action'

const getStore = () => useEditorStore.getState()

/**
 * Escape leaves the full preview, unless a dialog, menu or field owns the key. Checked in the
 * capture phase, so a tooltip that Escape also closes (on a focused header control) does not
 * swallow it.
 */
function isLeaveFullPress(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) return false
  if (isTextEntry(event.target) || isInsideOverlay(event.target)) return false
  return getStore().panels.layout === 'full'
}

/**
 * Panel keys: B, I, P and C toggle the Blackboard, Inspector, Preview and Code panels, and
 * Shift+P cycles the preview layout, while focus is on the canvas, a node or a panel header.
 * Escape leaves the full preview. Mounted once.
 */
export function usePanelShortcuts(): void {
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
      if (action.kind === 'toggle') getStore().togglePanel(action.panel)
      else getStore().cyclePreviewLayout()
    }
    window.addEventListener('keydown', onKeyDownCapture, { capture: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDownCapture, { capture: true })
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
