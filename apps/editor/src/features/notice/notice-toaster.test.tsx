import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/app/theme-provider'
import { translateEnglish } from '@/i18n/translate'
import { CANVAS_ID } from '@/shared/lib/landmarks'
import { useEditorStore } from '@/store/editor-store'
import type { Notice } from '@/store/store-types'

import { NoticeToaster } from './notice-toaster'

const MASTER_NOTICE: Notice = { kind: 'info', messageKey: 'notice.masterDelete' }
const CONNECT_NOTICE: Notice = { kind: 'error', messageKey: 'notice.connectFailed' }
const RESTORE_NOTICE: Notice = {
  kind: 'error',
  messageKey: 'notice.restoreFailed',
  persistent: true,
}
const CLOSE_BUTTON_NAME = 'Close notification'

const getState = () => useEditorStore.getState()

function toastTexts(): string[] {
  return [...document.querySelectorAll('[data-sonner-toast]')].map((toast) => toast.textContent)
}

function toastButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-sonner-toast] button')]
}

function buttonNamed(name: string): HTMLButtonElement | undefined {
  return toastButtons().find(
    (button) => button.textContent === name || button.getAttribute('aria-label') === name,
  )
}

function firstToast(): HTMLElement {
  const toast = document.querySelector<HTMLElement>('[data-sonner-toast]')
  if (toast === null) throw new Error('No toast is showing')
  return toast
}

/** Sonner adds and removes toasts on a timer, so the DOM catches up a moment after the store. */
async function expectToasts(expected: readonly string[]): Promise<void> {
  await vi.waitFor(() => {
    expect(toastTexts()).toEqual(expected)
  })
}

describe('NoticeToaster', () => {
  let container: HTMLDivElement
  let root: Root

  const mount = (): void => {
    act(() => {
      root.render(
        <ThemeProvider>
          <main id={CANVAS_ID} tabIndex={-1} />
          <NoticeToaster />
        </ThemeProvider>,
      )
    })
  }

  const showNotice = (notice: Notice): void => {
    act(() => {
      getState().showNotice(notice)
    })
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    getState().dismissNotice()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    getState().dismissNotice()
  })

  it('shows a store notice as a toast with the same text', async () => {
    mount()

    showNotice(MASTER_NOTICE)

    await expectToasts([translateEnglish(MASTER_NOTICE.messageKey)])
  })

  it('announces toasts through a polite live region labelled with the hotkey', () => {
    mount()

    const region = document.querySelector('section[aria-live]')

    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.getAttribute('aria-label')).toBe('Notifications alt+T')
  })

  it('makes an error toast an alert and leaves an info toast to the polite region', async () => {
    mount()

    showNotice(CONNECT_NOTICE)
    await vi.waitFor(() => {
      expect(firstToast().querySelector('[role="alert"]')?.textContent).toBe(
        translateEnglish(CONNECT_NOTICE.messageKey),
      )
    })

    showNotice(MASTER_NOTICE)
    await expectToasts([translateEnglish(MASTER_NOTICE.messageKey)])
    expect(firstToast().querySelector('[role="alert"]')).toBeNull()
  })

  it('shows a notice that was already in the store before the toaster mounted', async () => {
    getState().showNotice(RESTORE_NOTICE)

    mount()

    await vi.waitFor(() => {
      expect(toastTexts().join()).toContain(translateEnglish(RESTORE_NOTICE.messageKey))
    })
  })

  it('clears the store notice when the toast is closed', async () => {
    mount()
    showNotice(MASTER_NOTICE)
    await vi.waitFor(() => {
      expect(buttonNamed(CLOSE_BUTTON_NAME)).toBeDefined()
    })

    act(() => {
      buttonNamed(CLOSE_BUTTON_NAME)?.click()
    })

    expect(getState().notice).toBeNull()
    await expectToasts([])
  })

  it('takes the toast down when the notice is dismissed in code', async () => {
    mount()
    showNotice(MASTER_NOTICE)
    await vi.waitFor(() => {
      expect(toastTexts()).toHaveLength(1)
    })

    act(() => {
      getState().dismissNotice()
    })

    await expectToasts([])
  })

  it('offers Dismiss instead of a close button on a persistent notice', async () => {
    mount()
    showNotice(RESTORE_NOTICE)
    await vi.waitFor(() => {
      expect(buttonNamed('Dismiss')).toBeDefined()
    })

    expect(buttonNamed(CLOSE_BUTTON_NAME)).toBeUndefined()
    act(() => {
      buttonNamed('Dismiss')?.click()
    })

    expect(getState().notice).toBeNull()
  })

  it('replaces the toast when a different notice arrives', async () => {
    mount()
    showNotice(MASTER_NOTICE)
    await vi.waitFor(() => {
      expect(toastTexts()).toHaveLength(1)
    })

    showNotice(CONNECT_NOTICE)

    await vi.waitFor(() => {
      expect(toastTexts()).toHaveLength(1)
      expect(toastTexts().join()).toContain(translateEnglish(CONNECT_NOTICE.messageKey))
    })
  })

  it('hands focus from the toast list to the front toast, which shows the focus ring', async () => {
    mount()
    showNotice(MASTER_NOTICE)
    await vi.waitFor(() => {
      expect(toastTexts()).toHaveLength(1)
    })

    act(() => {
      document.querySelector<HTMLElement>('[data-sonner-toaster]')?.focus()
    })

    expect(document.activeElement).toBe(firstToast())
  })

  it('dismisses with Escape and gives focus back to what had it before', async () => {
    mount()
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    showNotice(MASTER_NOTICE)
    await vi.waitFor(() => {
      expect(toastTexts()).toHaveLength(1)
    })

    act(() => {
      firstToast().focus()
    })
    act(() => {
      firstToast().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    await vi.waitFor(() => {
      expect(getState().notice).toBeNull()
    })
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
