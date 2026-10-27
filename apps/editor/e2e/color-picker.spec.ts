import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectFocusRing, expectQuietFieldFocus, tabUntilFocused } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import { COLOR_TO_BASE_COLOR, seedAutosave } from './support/seed-graph'

/** Longer than the compile debounce (150 ms), so a pending rebuild would have fired by then. */
const PAST_DEBOUNCE_MS = 500
const DRAG_STEPS = 10
/** The seeded Color node: linear [1, 0.2, 0.05], shown as sRGB hex. */
const SEEDED_LINEAR = { type: 'vec3', value: [1, 0.2, 0.05] } as const
const SEEDED_HEX = '#FF7C3F'
/** #1a2b3c decoded to linear light (IEC 61966-2-1). */
const HEX_1A2B3C_LINEAR = [0.01033, 0.024158, 0.045186] as const
const LINEAR_PRECISION_DIGITS = 5

function colorNode(page: Page): Locator {
  return page.getByRole('group', { name: 'Color', exact: true })
}

/** While the picker is open (a modal dialog) the rest of the page is hidden from the a11y tree. */
function colorSwatch(page: Page): Locator {
  return page
    .getByRole('group', { name: 'Color', exact: true, includeHidden: true })
    .getByRole('button', { name: 'Color', exact: true, includeHidden: true })
}

function picker(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Color', exact: true })
}

function saturationArea(page: Page): Locator {
  return picker(page).getByRole('slider', { name: 'Saturation and brightness' })
}

async function compileCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoCompileCount ?? 0)
}

async function previewApplyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoPreviewApplyCount ?? 0)
}

async function storedColor(page: Page): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === 'color')
  return node?.inputValues.color ?? null
}

/** Waits for the first compile and its debounce, so later counts only move for new reasons. */
async function waitForSettledCompile(page: Page): Promise<number> {
  await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
  await page.waitForTimeout(PAST_DEBOUNCE_MS)
  return compileCount(page)
}

/** The stored color's channels, empty while nothing is stored. */
async function storedChannels(page: Page): Promise<readonly number[]> {
  const stored = await storedColor(page)
  if (typeof stored !== 'object' || stored === null || !('value' in stored)) return []
  return Array.isArray(stored.value) ? stored.value.map(Number) : []
}

async function focusSwatchWithKeyboard(page: Page): Promise<void> {
  await colorNode(page).focus()
  await tabUntilFocused(page, colorSwatch(page))
}

async function openPickerWithKeyboard(page: Page): Promise<void> {
  await focusSwatchWithKeyboard(page)
  await page.keyboard.press('Enter')
  await expect(saturationArea(page)).toBeFocused()
}

/** A point at a fraction of a box, in viewport pixels. */
async function pointIn(
  locator: Locator,
  fx: number,
  fy: number,
): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Element has no bounding box')
  return { x: box.x + box.width * fx, y: box.y + box.height * fy }
}

test.describe('color picker', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await expect(colorSwatch(page)).toHaveAccessibleDescription(SEEDED_HEX)
  })

  test('the swatch announces that it opens a dialog', async ({ page }) => {
    await expect(colorSwatch(page)).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(colorSwatch(page)).toHaveAttribute('aria-expanded', 'false')
  })

  test('dragging in the picker updates the node color and the preview without Enter', async ({
    page,
  }) => {
    const compilesBefore = await waitForSettledCompile(page)
    const appliedBefore = await previewApplyCount(page)

    await colorSwatch(page).click()
    const area = saturationArea(page)
    await expect(area).toBeVisible()
    const start = await pointIn(area, 0.2, 0.2)
    const end = await pointIn(area, 0.9, 0.6)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: DRAG_STEPS })

    // Mid-drag: the swatch and the material follow, but the graph (and its history) has not.
    await expect(colorSwatch(page)).not.toHaveAccessibleDescription(SEEDED_HEX)
    await expect.poll(() => previewApplyCount(page)).toBeGreaterThan(appliedBefore)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    expect(await storedColor(page)).toEqual(SEEDED_LINEAR)
    expect(await compileCount(page)).toBe(compilesBefore)

    await page.mouse.up()
    const draggedHex = await picker(page).getByRole('textbox', { name: 'Hex' }).inputValue()

    // A press outside closes the picker and commits what was picked.
    const outside = await pointIn(page.locator('.react-flow__pane'), 0.02, 0.5)
    await page.mouse.click(outside.x, outside.y)
    await expect(picker(page)).toBeHidden()
    await expect.poll(() => storedColor(page)).not.toEqual(SEEDED_LINEAR)
    await expect(colorSwatch(page)).toHaveAccessibleDescription(draggedHex)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    expect(await compileCount(page)).toBe(compilesBefore)
  })

  test('keyboard-only: open picker, arrows change hue, Enter commits, one undo restores', async ({
    page,
  }) => {
    await openPickerWithKeyboard(page)
    await page.keyboard.press('Tab')
    const hue = picker(page).getByRole('slider', { name: 'Hue' })
    await expect(hue).toBeFocused()
    const hueBefore = Number(await hue.getAttribute('aria-valuenow'))

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(hue).toHaveAttribute('aria-valuenow', String(hueBefore + 12))
    await page.keyboard.press('ArrowLeft')
    await expect(hue).toHaveAttribute('aria-valuenow', String(hueBefore + 11))
    await expect(colorSwatch(page)).not.toHaveAccessibleDescription(SEEDED_HEX)
    expect(await storedColor(page)).toEqual(SEEDED_LINEAR)

    await page.keyboard.press('Enter')
    await expect(picker(page)).toBeHidden()
    await expect(colorSwatch(page)).toBeFocused()
    await expect.poll(() => storedColor(page)).not.toEqual(SEEDED_LINEAR)

    // The whole picker session is one history entry.
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(() => storedColor(page)).toEqual(SEEDED_LINEAR)
    await expect(colorSwatch(page)).toHaveAccessibleDescription(SEEDED_HEX)
  })

  test('Escape cancels and restores the original color', async ({ page }) => {
    // Previews only reach a material once the first one has compiled.
    await waitForSettledCompile(page)
    await openPickerWithKeyboard(page)
    const area = saturationArea(page)
    const saturationBefore = Number(await area.getAttribute('aria-valuenow'))
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.press('ArrowDown')
    await expect(area).toHaveAttribute('aria-valuenow', String(saturationBefore - 11))
    await expect(area).toHaveAttribute('aria-valuetext', /^Saturation \d+%, brightness \d+%$/)
    await expect(colorSwatch(page)).not.toHaveAccessibleDescription(SEEDED_HEX)
    const appliedBeforeEscape = await previewApplyCount(page)

    await page.keyboard.press('Escape')
    await expect(picker(page)).toBeHidden()
    await expect(colorSwatch(page)).toBeFocused()
    await expect(colorSwatch(page)).toHaveAccessibleDescription(SEEDED_HEX)
    // The material is put back on the original color too.
    await expect.poll(() => previewApplyCount(page)).toBeGreaterThan(appliedBeforeEscape)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    expect(await storedColor(page)).toEqual(SEEDED_LINEAR)
  })

  test('hex field accepts #1a2b3c and shows it uppercase', async ({ page }) => {
    await openPickerWithKeyboard(page)
    const hex = picker(page).getByRole('textbox', { name: 'Hex' })
    await hex.fill('#1a2b3c')

    // Typing previews live; the channel fields follow.
    await expect(colorSwatch(page)).toHaveAccessibleDescription('#1A2B3C')
    await expect(picker(page).getByRole('textbox', { name: 'Red' })).toHaveValue('26')
    await expect(picker(page).getByRole('textbox', { name: 'Green' })).toHaveValue('43')
    await expect(picker(page).getByRole('textbox', { name: 'Blue' })).toHaveValue('60')

    await page.keyboard.press('Enter')
    await expect(picker(page)).toBeHidden()
    await expect.poll(() => storedColor(page)).not.toEqual(SEEDED_LINEAR)
    const channels = await storedChannels(page)
    expect(channels).toHaveLength(HEX_1A2B3C_LINEAR.length)
    HEX_1A2B3C_LINEAR.forEach((expected, index) => {
      expect(channels[index]).toBeCloseTo(expected, LINEAR_PRECISION_DIGITS)
    })
    await expect(colorSwatch(page)).toHaveAccessibleDescription('#1A2B3C')
  })

  test('typing a channel previews it; text that is not 0-255 is flagged and reverts', async ({
    page,
  }) => {
    await openPickerWithKeyboard(page)
    const red = picker(page).getByRole('textbox', { name: 'Red' })
    await red.fill('0')
    await expect(picker(page).getByRole('textbox', { name: 'Hex' })).toHaveValue('#007C3F')

    await red.fill('300')
    await expect(red).toHaveAttribute('aria-invalid', 'true')
    await red.press('Tab')
    await expect(red).toHaveValue('0')
    await expect(red).toHaveAttribute('aria-invalid', 'false')
  })

  test('Tab cycles through the picker controls and stays inside it', async ({ page }) => {
    await openPickerWithKeyboard(page)
    const dialog = picker(page)
    const order = [
      dialog.getByRole('slider', { name: 'Hue' }),
      dialog.getByRole('textbox', { name: 'Hex' }),
      dialog.getByRole('textbox', { name: 'Red' }),
      dialog.getByRole('textbox', { name: 'Green' }),
      dialog.getByRole('textbox', { name: 'Blue' }),
      dialog.getByRole('button', { name: 'Pick a color from the screen' }),
      saturationArea(page),
    ]
    for (const control of order) {
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
    }
  })

  test('text fields use the quiet border; the swatch, area and hue slider use the ring', async ({
    page,
  }) => {
    await focusSwatchWithKeyboard(page)
    await expectFocusRing(page, colorSwatch(page))

    await page.keyboard.press('Enter')
    await expectFocusRing(page, saturationArea(page))
    await page.keyboard.press('Tab')
    await expectFocusRing(page, picker(page).getByRole('slider', { name: 'Hue' }))
    await page.keyboard.press('Tab')
    await expectQuietFieldFocus(page, picker(page).getByRole('textbox', { name: 'Hex' }))
    await page.keyboard.press('Tab')
    await expectQuietFieldFocus(page, picker(page).getByRole('textbox', { name: 'Red' }))
  })
})
