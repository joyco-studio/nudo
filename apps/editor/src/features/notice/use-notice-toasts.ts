import { useEffect } from 'react'
import { toast } from 'sonner'

import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useEditorStore } from '@/store/editor-store'
import type { Notice } from '@/store/store-types'

import { syncNoticeToast } from './notice-toasts'
import { isInsideToaster, trackToasterFocus } from './toaster-focus'

const getStore = () => useEditorStore.getState()

/**
 * Shows the store's notice as a toast and keeps the two in step: a new notice replaces the toast,
 * and the toast closing (timer, close button, swipe, Escape) clears the notice. Escape inside the
 * toasts closes them and gives focus back to where it was. Mounted once, beside the `<Toaster>`.
 */
export function useNoticeToasts(): void {
  useEffect(() => {
    const focus = trackToasterFocus(document, () => document.getElementById(CANVAS_ID))

    const sync = (notice: Notice | null): void => {
      syncNoticeToast(notice, toast, () => {
        // A toast replaced by a newer notice must not clear that one when it closes.
        if (notice !== null && getStore().notice === notice) getStore().dismissNotice()
        focus.returnFocus()
      })
    }

    // A notice can predate the toaster (the autosave restore failure is set during bootstrap).
    sync(getStore().notice)
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.notice !== previous.notice) sync(state.notice)
    })

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !isInsideToaster(event.target)) return
      event.preventDefault()
      toast.dismiss()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unsubscribe()
      focus.stop()
    }
  }, [])
}
