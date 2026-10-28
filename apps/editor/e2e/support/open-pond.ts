import { expect, type Page } from '@playwright/test'

import { pickExampleByKeyboard } from './open-example'
import { compileCount, firstSettledCompileCount, settledCompileCount } from './pending-work'
import { readStoredNodes } from './read-autosave'

/** The pond has well over sixty nodes, besides its comment frames and the master. */
const MIN_POND_NODES = 60

/**
 * Opens the pond on a fresh page and waits for its own compile, not the page's first one, to
 * land with no node errors.
 */
export async function openPond(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()
  // The page compiles its starting graph first; the baseline comes after that.
  const compilesBefore = await firstSettledCompileCount(page)
  await pickExampleByKeyboard(page, 'Lettra pond')
  await expect
    .poll(async () => (await readStoredNodes(page)).length)
    .toBeGreaterThan(MIN_POND_NODES)
  await expect.poll(() => compileCount(page)).toBeGreaterThan(compilesBefore)
  await settledCompileCount(page)
  await expect(page.locator('[data-error="true"]')).toHaveCount(0)
}
