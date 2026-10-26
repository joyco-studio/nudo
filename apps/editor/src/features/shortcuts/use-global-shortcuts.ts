import { useEffect } from 'react'

import { redo, undo } from '@/store/editor-store'

/** Text fields keep their own undo, so shortcuts never fire while typing. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

function historyAction(event: KeyboardEvent): (() => void) | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? redo : undo
  if (key === 'y' && event.ctrlKey) return redo
  return null
}

/** Editor-wide keyboard shortcuts. Mounted once in `App`. */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || isTextEntry(event.target)) return
      const action = historyAction(event)
      if (action === null) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}
