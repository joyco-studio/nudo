import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** A quarter turn, as the closed chevron shows it. */
const CLOSED_DEGREES = -90
/** Well inside the 250ms rotation. */
const MID_ROTATION_MS = 90
const SETTLED_DEGREES_TOLERANCE = 0.5

function masterToggle(page: Page): Locator {
  return page
    .getByRole('group', { name: 'Master Stack', exact: true })
    .getByRole('button', { name: 'Unconnected ports' })
}

/** The chevron's current rotation in degrees, read from its computed matrix. */
async function rotationDegrees(chevron: Locator): Promise<number> {
  return chevron.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform)
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
  })
}

test.describe('with motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('the Master Stack toggle rotates one chevron instead of swapping icons', async ({
    page,
  }) => {
    await page.goto('/')
    const toggle = masterToggle(page)
    const chevron = toggle.locator('svg')
    await expect(chevron).toHaveCount(1)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await rotationDegrees(chevron)).toBeCloseTo(0, 1)

    const before = await chevron.elementHandle()

    await toggle.click()
    await page.waitForTimeout(MID_ROTATION_MS)
    const midway = await rotationDegrees(chevron)
    expect(midway).toBeLessThan(-SETTLED_DEGREES_TOLERANCE)
    expect(midway).toBeGreaterThan(CLOSED_DEGREES + SETTLED_DEGREES_TOLERANCE)

    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => rotationDegrees(chevron)).toBeCloseTo(CLOSED_DEGREES, 1)

    // The same SVG element all along: nothing was swapped in or out.
    await expect(toggle.locator('svg')).toHaveCount(1)
    expect(await before.evaluate((element) => element.isConnected)).toBe(true)
    const after = await chevron.elementHandle()
    expect(await before.evaluate((element, other) => element === other, after)).toBe(true)

    await toggle.click()
    await expect.poll(() => rotationDegrees(chevron)).toBeCloseTo(0, 1)
  })

  test('only transform transitions', async ({ page }) => {
    await page.goto('/')
    const chevron = masterToggle(page).locator('svg')
    const properties = await chevron.evaluate(
      (element) => getComputedStyle(element).transitionProperty,
    )
    expect(properties).toBe('transform')
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the chevron turns instantly', async ({ page }) => {
    await page.goto('/')
    const toggle = masterToggle(page)
    const chevron = toggle.locator('svg')
    const duration = await chevron.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    )
    expect(duration).toBe('0s')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => rotationDegrees(chevron)).toBeCloseTo(CLOSED_DEGREES, 1)
  })
})
