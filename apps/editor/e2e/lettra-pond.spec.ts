import { expect, test, type Locator, type Page } from '@playwright/test'

import { changedShare, luminanceSpread } from './support/luminance-spread'
import { openPond } from './support/open-pond'
import { compileCount, settledCompileCount } from './support/pending-work'

/** A flat or nearly flat preview stays under this luminance spread; the pond's pattern is far above. */
const MIN_LUMINANCE_SPREAD = 12
/** Refraction moves the pattern: this share of the preview changes within a second. */
const MIN_CHANGED_SHARE = 0.01
const REFRACTION_GAP_MS = 1000
const DRAG_STEPS = 8
/** The pond's first picture waits for its shaders, slow in software rendering under load. */
const FIRST_PICTURE_TIMEOUT_MS = 30_000

function previewCanvas(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' }).locator('canvas')
}

async function previewApplyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoPreviewApplyCount ?? 0)
}

test.describe('lettra pond example', () => {
  test.setTimeout(120_000)

  test('loads, has no node errors, renders a non-uniform image', async ({ page }) => {
    await openPond(page)

    await expect(page.getByRole('group', { name: 'Rosettes', exact: true })).toBeAttached()
    await expect(page.getByRole('radio', { name: 'Plane', exact: true })).toBeChecked()
    await expect
      .poll(async () => luminanceSpread(page, await previewCanvas(page).screenshot()), {
        timeout: FIRST_PICTURE_TIMEOUT_MS,
      })
      .toBeGreaterThan(MIN_LUMINANCE_SPREAD)

    // The refraction scrolls with Time: the water keeps moving.
    const before = await previewCanvas(page).screenshot()
    await page.waitForTimeout(REFRACTION_GAP_MS)
    const after = await previewCanvas(page).screenshot()
    expect(await changedShare(page, before, after)).toBeGreaterThan(MIN_CHANGED_SHARE)
  })

  test('and scrubbing a palette property triggers no compile', async ({ page }) => {
    await openPond(page)
    const compilesBefore = await compileCount(page)
    const appliedBefore = await previewApplyCount(page)

    const row = page
      .getByRole('region', { name: 'Properties', exact: true })
      .getByRole('group', { name: 'Rim · shade', exact: true })
    await row.getByRole('button', { name: 'Color', exact: true }).click()
    const area = page
      .getByRole('dialog', { name: 'Color', exact: true })
      .getByRole('slider', { name: 'Saturation and brightness' })
    const box = await area.boundingBox()
    if (box === null) throw new Error('The saturation area is not rendered')
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6, { steps: DRAG_STEPS })
    await expect.poll(() => previewApplyCount(page)).toBeGreaterThan(appliedBefore)
    await page.mouse.up()
    await page.keyboard.press('Enter')

    expect(await settledCompileCount(page)).toBe(compilesBefore)
  })
})
