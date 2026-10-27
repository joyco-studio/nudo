import type { Locator, Page } from '@playwright/test'

/** Every toast on screen (sonner renders each as a list item of the notifications region). */
export function toasts(page: Page): Locator {
  return page.locator('[data-sonner-toast]')
}

/** The live region that announces toasts; Alt+T moves focus into it. */
export function notificationsRegion(page: Page): Locator {
  return page.getByRole('region', { name: /^Notifications/ })
}
