import { useCallback } from 'react'

import { CANVAS_ID } from '@/app/app-shell'
import { useEditorStore } from '@/store/editor-store'

import { NoticeRegion } from './notice-region'

export function NoticeRegionContainer() {
  const notice = useEditorStore((state) => state.notice)

  // The dismiss button unmounts with the notice, so focus goes back to the canvas.
  const onDismiss = useCallback(() => {
    useEditorStore.getState().dismissNotice()
    document.getElementById(CANVAS_ID)?.focus()
  }, [])

  return <NoticeRegion notice={notice} onDismiss={onDismiss} />
}
