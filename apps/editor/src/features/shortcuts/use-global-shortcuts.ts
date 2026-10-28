import { useEffect } from 'react'

import { useRunCommand } from '@/features/command-palette/command-context'
import { invocationFrom } from '@/features/command-palette/command-registry'
import { htmlElementOf } from '@/shared/lib/html-element-of'
import { isInsideOverlay } from '@/shared/lib/is-inside-overlay'
import { isTextEntry } from '@/shared/lib/is-text-entry'

import { globalShortcutAction } from './shortcut-action'

function hasSelectedText(): boolean {
  return (window.getSelection()?.toString() ?? '') !== ''
}

/**
 * Editor-wide keyboard shortcuts: undo and redo, copy and paste, select all, fit view, tidy up,
 * new graph and the shortcuts dialog. Each key runs the registry command with the same id, with
 * the key's target as the opener. Mounted once, inside the command provider.
 */
export function useGlobalShortcuts(): void {
  const runCommand = useRunCommand()

  useEffect(() => {
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
      runCommand(action, invocationFrom(htmlElementOf(event.target)))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [runCommand])
}
