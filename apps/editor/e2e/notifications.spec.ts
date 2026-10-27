import { expect, test, type Page } from '@playwright/test'

import { expectFocusRing } from './support/focus-indicators'
import { COLOR_TO_BASE_COLOR, seedAutosave } from './support/seed-graph'
import { notificationsRegion, toasts } from './support/toasts'

const MASTER_DELETE_MESSAGE = "The Master Stack can't be deleted."
const RESTORE_FAILED_MESSAGE = "Couldn't restore your last session"
/** Sonner closes an info toast after 5 s; the margin covers its 200 ms exit and a slow runner. */
const INFO_TOAST_LIFETIME_MS = 8_000

/** Deleting the master is the simplest way to raise an info notice from the keyboard. */
async function raiseMasterDeleteNotice(page: Page): Promise<void> {
  await seedAutosave(page, COLOR_TO_BASE_COLOR)
  await page.goto('/')
  const master = page.getByRole('group', { name: 'Master Stack', exact: true })
  await master.focus()
  await page.keyboard.press('Delete')
}

test.describe('notifications', () => {
  test('a notice appears as a toast and closes by itself', async ({ page }) => {
    await raiseMasterDeleteNotice(page)

    await expect(toasts(page)).toHaveText(MASTER_DELETE_MESSAGE)
    await expect(toasts(page)).toHaveCount(0, { timeout: INFO_TOAST_LIFETIME_MS })
  })

  test('toasts are announced politely and name their hotkey', async ({ page }) => {
    await raiseMasterDeleteNotice(page)

    const region = notificationsRegion(page)

    await expect(region).toHaveAttribute('aria-live', 'polite')
    await expect(region).toHaveAccessibleName('Notifications alt+T')
    await expect(region).toContainText(MASTER_DELETE_MESSAGE)
  })

  test('Alt+T focuses the toast with a ring and Escape dismisses it and returns focus', async ({
    page,
  }) => {
    await raiseMasterDeleteNotice(page)
    await expect(toasts(page)).toHaveCount(1)

    await page.keyboard.press('Alt+T')

    await expectFocusRing(page, toasts(page))

    await page.keyboard.press('Escape')

    await expect(toasts(page)).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeFocused()
  })

  test('a toast is closed from the keyboard with its close button', async ({ page }) => {
    await raiseMasterDeleteNotice(page)
    await expect(toasts(page)).toHaveCount(1)
    await page.keyboard.press('Alt+T')

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Close notification' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(toasts(page)).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeFocused()
  })

  test('an error toast is an alert that the keyboard can reach and dismiss', async ({ page }) => {
    await seedAutosave(page, '{not json')
    await page.goto('/')
    const toast = toasts(page)
    await expect(toast.getByRole('alert')).toContainText(RESTORE_FAILED_MESSAGE)
    await page.locator('#node-canvas').focus()

    await page.keyboard.press('Alt+T')
    await expect(toast).toBeFocused()

    // Editor shortcuts stay quiet while the toasts own the keyboard.
    await page.keyboard.press('Shift+?')
    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.press('Space')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(toast).toHaveCount(1)

    await page.keyboard.press('Escape')

    await expect(toast).toHaveCount(0)
    await expect(page.locator('#node-canvas')).toBeFocused()
  })

  test('a notice that needs an answer offers Dismiss and does not time out', async ({ page }) => {
    await seedAutosave(page, '{not json')
    await page.goto('/')
    const toast = toasts(page)
    await expect(toast).toContainText("Couldn't restore your last session")
    await expect(toast.getByRole('button', { name: 'Close notification' })).toHaveCount(0)

    await page.keyboard.press('Alt+T')
    // Focus is on the toast, then its action.
    await page.keyboard.press('Tab')
    await expect(toast.getByRole('button', { name: 'Dismiss' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(toast).toHaveCount(0)
    await expect(page.locator('#node-canvas')).toBeFocused()
  })

  test('toasts do not animate when the person prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await raiseMasterDeleteNotice(page)

    const toast = toasts(page)
    await expect(toast).toHaveCount(1)

    await expect(toast).toHaveCSS('transition-duration', '0s')
    await expect(toast).toHaveCSS('animation-name', 'none')
  })

  test('toasts follow the theme', async ({ page }) => {
    await raiseMasterDeleteNotice(page)
    await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute('data-sonner-theme', 'dark')

    await page.getByRole('button', { name: 'Dark theme' }).click()

    await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute(
      'data-sonner-theme',
      'light',
    )
  })
})
