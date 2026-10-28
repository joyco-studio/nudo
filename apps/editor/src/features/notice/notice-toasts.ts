import { createElement } from 'react'
import type { ReactNode } from 'react'

import type { Translate } from '@/i18n/translate'
import type { Notice } from '@/store/store-types'

/** Every notice uses this id, so a new one replaces the toast on screen instead of piling up. */
export const NOTICE_TOAST_ID = 'editor-notice'

export const INFO_NOTICE_DURATION_MS = 5_000
/** An error takes longer to read and act on than a passing hint. */
export const ERROR_NOTICE_DURATION_MS = 8_000
const PERSISTENT_NOTICE_DURATION_MS = Infinity

export interface NoticeToastOptions {
  id: string
  duration: number
  closeButton: boolean
  action?: { label: string; onClick: () => void }
  /** The person closed it (close button, swipe, Escape) or it was taken down in code. */
  onDismiss: () => void
  /** Its timer ran out. */
  onAutoClose: () => void
}

/** The slice of sonner's `toast` this adapter uses, so tests can stand in for it. */
export interface NoticeToastApi {
  info(message: ReactNode, options: NoticeToastOptions): unknown
  error(message: ReactNode, options: NoticeToastOptions): unknown
  dismiss(id: string): unknown
}

function durationFor(notice: Notice): number {
  if (notice.persistent === true) return PERSISTENT_NOTICE_DURATION_MS
  return notice.kind === 'error' ? ERROR_NOTICE_DURATION_MS : INFO_NOTICE_DURATION_MS
}

function toastOptionsFor(notice: Notice, onClosed: () => void, t: Translate): NoticeToastOptions {
  const isPersistent = notice.persistent === true
  return {
    id: NOTICE_TOAST_ID,
    duration: durationFor(notice),
    // A persistent notice has its Dismiss action; a second control for the same thing is noise.
    closeButton: !isPersistent,
    ...(isPersistent && { action: { label: t('notice.dismiss'), onClick: onClosed } }),
    onDismiss: onClosed,
    onAutoClose: onClosed,
  }
}

/**
 * The toaster announces every toast through its polite live region; an error also interrupts, as
 * an alert, because it reports something that went wrong.
 */
function messageOf(notice: Notice, t: Translate): ReactNode {
  const message = t(notice.messageKey)
  if (notice.kind !== 'error') return message
  return createElement('span', { role: 'alert' }, message)
}

/** Shows the notice as a toast, in the UI language. `onClosed` runs however the toast ends. */
export function showNoticeToast(
  notice: Notice,
  api: NoticeToastApi,
  onClosed: () => void,
  t: Translate,
): void {
  const options = toastOptionsFor(notice, onClosed, t)
  const message = messageOf(notice, t)
  if (notice.kind === 'error') api.error(message, options)
  else api.info(message, options)
}

/** Brings the toast in line with the store's notice: shown while there is one, gone otherwise. */
export function syncNoticeToast(
  notice: Notice | null,
  api: NoticeToastApi,
  onClosed: () => void,
  t: Translate,
): void {
  if (notice === null) {
    api.dismiss(NOTICE_TOAST_ID)
    return
  }
  showNoticeToast(notice, api, onClosed, t)
}
