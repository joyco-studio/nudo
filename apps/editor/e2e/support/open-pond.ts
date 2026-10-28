import { expect, type Page } from '@playwright/test'

import { pickExampleByKeyboard } from './open-example'
import { readStoredNodes } from './read-autosave'

/** Longer than the compile debounce (150 ms), so a pending rebuild would have fired by then. */
const COMPILE_SETTLE_INTERVAL_MS = 500
/** The pond has well over sixty nodes, besides its comment frames and the master. */
const MIN_POND_NODES = 60

export async function compileCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoCompileCount ?? 0)
}

/** The compile count once it stops rising: no rebuild is pending past the debounce. */
async function settledCompileCount(page: Page): Promise<number> {
  let previous = -1
  await expect
    .poll(
      async () => {
        const current = await compileCount(page)
        const isSettled = current === previous
        previous = current
        return isSettled
      },
      { intervals: [COMPILE_SETTLE_INTERVAL_MS] },
    )
    .toBe(true)
  return previous
}

/**
 * Opens the pond on a fresh page and waits for its own compile, not the page's first one, to
 * land with no node errors.
 */
export async function openPond(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()
  // The page compiles its starting graph first; the baseline comes after that.
  await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
  const compilesBefore = await settledCompileCount(page)
  await pickExampleByKeyboard(page, 'Lettra pond')
  await expect
    .poll(async () => (await readStoredNodes(page)).length)
    .toBeGreaterThan(MIN_POND_NODES)
  await expect.poll(() => compileCount(page)).toBeGreaterThan(compilesBefore)
  await settledCompileCount(page)
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
}
