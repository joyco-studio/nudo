import { useEffect } from 'react'

import { htmlElementOf } from '@/shared/lib/html-element-of'

import { addNodeShortcutOrigin } from './add-node-shortcut'
import type { OpenAddNodeMenu } from './add-node-menu-context'

/**
 * Space on the canvas opens the add-node menu. Listens in the capture phase so React Flow doesn't
 * also treat Space as "select the focused node", and prevents the default page scroll.
 */
export function useAddNodeShortcut(openMenu: OpenAddNodeMenu): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const origin = addNodeShortcutOrigin(event)
      if (origin === null) return
      event.preventDefault()
      event.stopPropagation()
      openMenu(origin, htmlElementOf(event.target))
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [openMenu])
}
