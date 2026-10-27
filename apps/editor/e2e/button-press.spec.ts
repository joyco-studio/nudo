import { expect, test, type Locator, type Page } from '@playwright/test'

const HARNESS_URL = '/e2e/harness/button-triggers.html'
/** The press scale for pointer presses (better-ui, ruling P2-R12). */
const PRESS_SCALE = 0.96
const SCALE_DIGITS = 2
/** Long enough for a 150ms press transition to have moved, if one was going to start. */
const KEYBOARD_SETTLE_MS = 300
const IDENTITY_SCALE = 1

interface KeyboardOpenCase {
  readonly name: string
  readonly opened: (page: Page) => Locator
}

const KEYBOARD_OPEN_CASES: readonly KeyboardOpenCase[] = [
  { name: 'Dropdown', opened: (page) => page.getByRole('menu') },
  { name: 'Select', opened: (page) => page.getByRole('listbox') },
  {
    name: 'Popover',
    opened: (page) => page.locator('[data-slot="popover-content"]'),
  },
  {
    name: 'Collapsible',
    opened: (page) => page.locator('[data-slot="collapsible-content"]'),
  },
  { name: 'Dialog', opened: (page) => page.getByRole('dialog') },
]

/** Horizontal scale of the computed transform; 1 with none. */
async function scaleOf(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const { transform } = getComputedStyle(element)
    return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a
  })
}

test.describe('with motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' })

  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS_URL)
  })

  for (const { name, opened } of KEYBOARD_OPEN_CASES) {
    for (const key of ['Enter', 'Space'] as const) {
      test(`${key} on a button inside the ${name} trigger opens it once and it stays open`, async ({
        page,
      }) => {
        const trigger = page.getByText(name, { exact: true })
        await trigger.focus()
        await page.keyboard.press(key)

        await expect(opened(page)).toBeVisible()
        // A double toggle closes it again a frame or two later: it has to still be there.
        await page.waitForTimeout(KEYBOARD_SETTLE_MS)
        await expect(opened(page)).toBeVisible()
      })
    }
  }

  for (const key of ['Enter', 'Space'] as const) {
    test(`${key} on a regular button fires its click once`, async ({ page }) => {
      await page.getByRole('button', { name: 'Plain', exact: true }).focus()
      await page.keyboard.press(key)

      await expect(page.getByLabel('Plain clicks')).toHaveText('1')
      await page.waitForTimeout(KEYBOARD_SETTLE_MS)
      await expect(page.getByLabel('Plain clicks')).toHaveText('1')
    })
  }

  test('a keyboard press never scales the button', async ({ page }) => {
    const plain = page.getByRole('button', { name: 'Plain', exact: true })
    await plain.focus()

    await page.keyboard.down('Enter')
    await page.waitForTimeout(KEYBOARD_SETTLE_MS)
    expect(await scaleOf(plain)).toBe(IDENTITY_SCALE)
    await page.keyboard.up('Enter')
  })

  test('a pointer press scales the button to 0.96 and releases back to full size', async ({
    page,
  }) => {
    const plain = page.getByRole('button', { name: 'Plain', exact: true })
    const box = await plain.boundingBox()
    if (box === null) throw new Error('The button has no box')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect.poll(() => scaleOf(plain)).toBeCloseTo(PRESS_SCALE, SCALE_DIGITS)

    await page.mouse.up()
    await expect.poll(() => scaleOf(plain)).toBeCloseTo(IDENTITY_SCALE, SCALE_DIGITS)
    await expect(page.getByLabel('Plain clicks')).toHaveText('1')
  })

  test('a pointer press released outside the button still lets it go', async ({ page }) => {
    const plain = page.getByRole('button', { name: 'Plain', exact: true })
    const box = await plain.boundingBox()
    if (box === null) throw new Error('The button has no box')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect.poll(() => scaleOf(plain)).toBeCloseTo(PRESS_SCALE, SCALE_DIGITS)
    await page.mouse.move(box.x + box.width + 200, box.y + box.height + 200)
    await page.mouse.up()

    await expect.poll(() => scaleOf(plain)).toBeCloseTo(IDENTITY_SCALE, SCALE_DIGITS)
    await expect(page.getByLabel('Plain clicks')).toHaveText('0')
  })
})
