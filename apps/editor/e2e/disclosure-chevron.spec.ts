import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** A quarter turn, as the closed chevron shows it. */
const CLOSED_DEGREES = -90
const SETTLED_DEGREES_TOLERANCE = 0.5

function masterToggle(page: Page): Locator {
  return page
    .getByRole('group', { name: 'Master Stack', exact: true })
    .getByRole('button', { name: 'Unconnected ports' })
}

/**
 * Clicks the toggle from inside the page and samples its chevron halfway through the rotation it
 * starts: the CSS transition is paused at once and set to half its duration, so the sample does not
 * depend on how fast the machine runs. Returns the rotation in degrees.
 */
async function rotationHalfwayAfterClick(toggle: Locator): Promise<number> {
  return toggle.evaluate(async (button) => {
    const chevron = button.querySelector('svg')
    if (!(button instanceof HTMLElement) || chevron === null) throw new Error('No chevron')
    button.click()
    // React commits a click's update in a microtask; getAnimations() then flushes the style
    // change, which starts the transition.
    await Promise.resolve()
    const [transition] = chevron.getAnimations()
    if (transition === undefined) throw new Error('The chevron did not start a transition')
    transition.pause()
    transition.currentTime = Number(transition.effect?.getTiming().duration ?? 0) / 2
    const matrix = new DOMMatrix(getComputedStyle(chevron).transform)
    transition.play()
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
  })
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

    const midway = await rotationHalfwayAfterClick(toggle)
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
