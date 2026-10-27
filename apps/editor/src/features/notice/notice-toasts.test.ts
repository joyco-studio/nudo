import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Notice } from '@/store/store-types'

import {
  ERROR_NOTICE_DURATION_MS,
  INFO_NOTICE_DURATION_MS,
  NOTICE_TOAST_ID,
  showNoticeToast,
  syncNoticeToast,
} from './notice-toasts'
import type { NoticeToastApi, NoticeToastOptions } from './notice-toasts'

const INFO_NOTICE: Notice = { kind: 'info', message: "The Master Stack can't be deleted." }
const ERROR_NOTICE: Notice = { kind: 'error', message: "Couldn't connect those ports." }
const PERSISTENT_NOTICE: Notice = {
  kind: 'error',
  message: "Couldn't restore your last session, so we started a new graph.",
  persistent: true,
}

function createApi() {
  return {
    info: vi.fn<(message: ReactNode, options: NoticeToastOptions) => void>(),
    error: vi.fn<(message: ReactNode, options: NoticeToastOptions) => void>(),
    dismiss: vi.fn<(id: string) => void>(),
  } satisfies NoticeToastApi
}

function optionsOf(
  calls: ReadonlyArray<readonly [message: ReactNode, options: NoticeToastOptions]>,
): NoticeToastOptions {
  const first = calls[0]
  if (first === undefined) throw new Error('The toast was never shown')
  return first[1]
}

describe('showNoticeToast', () => {
  it('shows an info notice as an info toast that closes by itself', () => {
    const api = createApi()

    showNoticeToast(INFO_NOTICE, api, vi.fn())

    expect(api.error).not.toHaveBeenCalled()
    expect(api.info).toHaveBeenCalledTimes(1)
    // The toaster's polite live region announces it; no role of its own.
    expect(api.info.mock.calls[0]?.[0]).toBe(INFO_NOTICE.message)
    const options = optionsOf(api.info.mock.calls)
    expect(options).toMatchObject({
      id: NOTICE_TOAST_ID,
      duration: INFO_NOTICE_DURATION_MS,
      closeButton: true,
    })
    expect(options.action).toBeUndefined()
  })

  it('shows an error notice as an error toast that stays a little longer', () => {
    const api = createApi()

    showNoticeToast(ERROR_NOTICE, api, vi.fn())

    expect(api.info).not.toHaveBeenCalled()
    expect(optionsOf(api.error.mock.calls).duration).toBe(ERROR_NOTICE_DURATION_MS)
    expect(ERROR_NOTICE_DURATION_MS).toBeGreaterThan(INFO_NOTICE_DURATION_MS)
  })

  it('announces an error assertively, as an alert', () => {
    const api = createApi()

    showNoticeToast(ERROR_NOTICE, api, vi.fn())

    expect(renderToStaticMarkup(api.error.mock.calls[0]?.[0])).toBe(
      `<span role="alert">Couldn&#x27;t connect those ports.</span>`,
    )
  })

  it('keeps a persistent notice until it is dismissed, with a Dismiss action', () => {
    const api = createApi()
    const onClosed = vi.fn()

    showNoticeToast(PERSISTENT_NOTICE, api, onClosed)

    const options = optionsOf(api.error.mock.calls)
    expect(options.duration).toBe(Infinity)
    expect(options.closeButton).toBe(false)
    expect(options.action?.label).toBe('Dismiss')
    options.action?.onClick()
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('reports the toast closing, whether by the person or by its timer', () => {
    const api = createApi()
    const onClosed = vi.fn()

    showNoticeToast(INFO_NOTICE, api, onClosed)
    const options = optionsOf(api.info.mock.calls)
    options.onDismiss()
    options.onAutoClose()

    expect(onClosed).toHaveBeenCalledTimes(2)
  })
})

describe('syncNoticeToast', () => {
  it('shows the notice when there is one', () => {
    const api = createApi()

    syncNoticeToast(ERROR_NOTICE, api, vi.fn())

    expect(api.error).toHaveBeenCalledTimes(1)
    expect(api.dismiss).not.toHaveBeenCalled()
  })

  it('takes the toast down when the notice is cleared', () => {
    const api = createApi()

    syncNoticeToast(null, api, vi.fn())

    expect(api.dismiss).toHaveBeenCalledWith(NOTICE_TOAST_ID)
    expect(api.info).not.toHaveBeenCalled()
    expect(api.error).not.toHaveBeenCalled()
  })
})
