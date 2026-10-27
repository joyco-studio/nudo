import { expect, test, type Locator, type Page } from '@playwright/test'

import { readStoredNodes } from './support/read-autosave'
import { COLOR_TO_BASE_COLOR, TIME_TO_SINE, seedAutosave } from './support/seed-graph'

const PANELS_STORAGE_KEY = 'nudo-tsl:panels'
/** Share of the workspace the canvas keeps in split view, and the bounds of the divider. */
const DEFAULT_SPLIT_PERCENT = '50'
const MIN_SPLIT_PERCENT = '25'
const MAX_SPLIT_PERCENT = '75'
const ARROW_PRESSES_PAST_MAX = 8
/** A uniform background has almost no spread; the checker room has two clearly distinct greys. */
const UNIFORM_SPREAD_MAX = 4
const CHECKER_SPREAD_MIN = 12

function canvas(page: Page): Locator {
  return page.getByRole('main', { name: 'Node canvas' })
}

function panelToggle(page: Page, title: string): Locator {
  return page.getByRole('button', { name: `${title} panel`, exact: true })
}

function preview(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' })
}

function layoutRadio(page: Page, name: 'Docked' | 'Split' | 'Full'): Locator {
  return page.getByRole('radiogroup', { name: 'Preview layout' }).getByRole('radio', { name })
}

async function focusCanvas(page: Page): Promise<void> {
  await canvas(page).focus()
  await expect(canvas(page)).toBeFocused()
}

/**
 * Standard deviation of the luminance in the top corners of a PNG screenshot: clear of the
 * centered mesh, where only the background (or the backdrop) shows.
 */
async function cornerLuminanceSpread(page: Page, screenshot: Buffer): Promise<number> {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const surface = document.createElement('canvas')
    surface.width = bitmap.width
    surface.height = bitmap.height
    const context = surface.getContext('2d')
    if (context === null) throw new Error('2D canvas unavailable')
    context.drawImage(bitmap, 0, 0)
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    const corner = Math.floor(Math.min(width, height) * 0.15)
    const samples: number[] = []
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        // Top corners only: the backend badge sits in the bottom-left one.
        const isNearSide = x < corner || x >= width - corner
        if (!isNearSide || y >= corner) continue
        const index = (y * width + x) * 4
        const luminance =
          0.2126 * (data[index] ?? 0) +
          0.7152 * (data[index + 1] ?? 0) +
          0.0722 * (data[index + 2] ?? 0)
        samples.push(luminance)
      }
    }
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length
    return Math.sqrt(variance)
  }, screenshot.toString('base64'))
}

test.describe('panels', () => {
  test('panels toggle with B/I/P/C and persist after reload', async ({ page }) => {
    await page.goto('/')
    const toggles = {
      blackboard: panelToggle(page, 'Properties'),
      inspector: panelToggle(page, 'Inspector'),
      preview: panelToggle(page, 'Preview'),
      code: panelToggle(page, 'Code'),
    }
    await expect(toggles.blackboard).toHaveAttribute('aria-expanded', 'true')
    await expect(toggles.inspector).toHaveAttribute('aria-expanded', 'true')
    await expect(toggles.preview).toHaveAttribute('aria-expanded', 'true')
    await expect(toggles.code).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('region', { name: 'Properties' })).toContainText(
      'No properties yet.',
    )
    await expect(page.getByRole('region', { name: 'Inspector' })).toContainText('Graph settings')

    await focusCanvas(page)
    await page.keyboard.press('b')
    await page.keyboard.press('i')
    await page.keyboard.press('p')
    await page.keyboard.press('c')
    await expect(toggles.blackboard).toHaveAttribute('aria-expanded', 'false')
    await expect(toggles.inspector).toHaveAttribute('aria-expanded', 'false')
    await expect(toggles.preview).toHaveAttribute('aria-expanded', 'false')
    await expect(toggles.code).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('region', { name: 'Code' })).toContainText(
      'Generated TSL appears here.',
    )

    // Ctrl+C is copy, not the Code panel.
    await page.keyboard.press('ControlOrMeta+c')
    await expect(toggles.code).toHaveAttribute('aria-expanded', 'true')

    // The letter also works from a panel header.
    await toggles.blackboard.focus()
    await page.keyboard.press('b')
    await expect(toggles.blackboard).toHaveAttribute('aria-expanded', 'true')

    await page.reload()
    await expect(toggles.blackboard).toHaveAttribute('aria-expanded', 'true')
    await expect(toggles.inspector).toHaveAttribute('aria-expanded', 'false')
    await expect(toggles.preview).toHaveAttribute('aria-expanded', 'false')
    await expect(toggles.code).toHaveAttribute('aria-expanded', 'true')
    const stored = await page.evaluate((key) => localStorage.getItem(key), PANELS_STORAGE_KEY)
    expect(stored).not.toBeNull()
  })

  test('panel letters are ignored while a field has focus', async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    const field = page.getByRole('textbox', { name: 'Roughness', exact: true })
    await field.focus()
    await page.keyboard.press('b')
    await expect(panelToggle(page, 'Properties')).toHaveAttribute('aria-expanded', 'true')
  })

  test('inspector names the selected node', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await page.getByRole('group', { name: 'Sine', exact: true }).click()
    const inspector = page.getByRole('region', { name: 'Inspector' })
    await expect(inspector).toContainText('Sine')
    await expect(inspector).not.toContainText('Graph settings')
  })
})

test.describe('preview layout', () => {
  test('preview layout cycles docked → split → full with Shift+P; Escape leaves full; divider resizes with arrow keys', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(layoutRadio(page, 'Docked')).toBeChecked()
    await expect(page.getByRole('separator', { name: 'Resize preview' })).toHaveCount(0)

    await focusCanvas(page)
    await page.keyboard.press('Shift+P')
    await expect(layoutRadio(page, 'Split')).toBeChecked()
    const divider = page.getByRole('separator', { name: 'Resize preview' })
    await expect(divider).toHaveAttribute('aria-valuenow', DEFAULT_SPLIT_PERCENT)

    const canvasWidthBefore = (await canvas(page).boundingBox())?.width ?? 0
    await divider.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(divider).toHaveAttribute('aria-valuenow', '45')
    await expect
      .poll(async () => (await canvas(page).boundingBox())?.width ?? 0)
      .toBeLessThan(canvasWidthBefore)
    for (let press = 0; press < ARROW_PRESSES_PAST_MAX; press += 1) {
      await page.keyboard.press('ArrowRight')
    }
    await expect(divider).toHaveAttribute('aria-valuenow', MAX_SPLIT_PERCENT)
    await page.keyboard.press('Home')
    await expect(divider).toHaveAttribute('aria-valuenow', MIN_SPLIT_PERCENT)

    await focusCanvas(page)
    await page.keyboard.press('Shift+P')
    await expect(layoutRadio(page, 'Full')).toBeChecked()
    // The canvas is covered and out of the tab order while the preview fills the workspace.
    await expect(page.locator('[data-workspace-canvas]')).toHaveAttribute('inert', '')
    const previewBox = await preview(page).boundingBox()
    const viewport = page.viewportSize()
    expect(previewBox?.width ?? 0).toBeGreaterThan((viewport?.width ?? 0) * 0.9)

    await page.keyboard.press('Escape')
    await expect(layoutRadio(page, 'Split')).toBeChecked()
    await expect(page.locator('[data-workspace-canvas]')).not.toHaveAttribute('inert', '')

    await page.reload()
    await expect(layoutRadio(page, 'Split')).toBeChecked()
    await expect(page.getByRole('separator', { name: 'Resize preview' })).toHaveAttribute(
      'aria-valuenow',
      MIN_SPLIT_PERCENT,
    )
  })

  test('the full preview is opaque, so the canvas does not show through', async ({ page }) => {
    await page.goto('/')
    await layoutRadio(page, 'Full').click()
    await expect(layoutRadio(page, 'Full')).toBeChecked()
    const background = await preview(page).evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    )
    // A translucent color serializes with an alpha after a slash: `oklab(… / 0.85)`.
    expect(background).not.toContain('/')
  })

  test('layout radios are named in their tooltips; the group carries the Shift+P shortcut', async ({
    page,
  }) => {
    await page.goto('/')
    const group = page.getByRole('radiogroup', { name: 'Preview layout' })
    await expect(group).toHaveAttribute('aria-keyshortcuts', 'Shift+P')
    await layoutRadio(page, 'Docked').focus()
    await expect(page.getByRole('tooltip')).toHaveText('Docked')
  })

  test('dragging the split divider stores the split once, on release', async ({ page }) => {
    await page.goto('/')
    await layoutRadio(page, 'Split').click()
    const divider = page.getByRole('separator', { name: 'Resize preview' })
    const box = await divider.boundingBox()
    if (box === null) throw new Error('Divider has no bounding box')
    const storedSplit = async (): Promise<unknown> => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), PANELS_STORAGE_KEY)
      const stored: unknown = raw === null ? null : JSON.parse(raw)
      return typeof stored === 'object' && stored !== null && 'splitPercent' in stored
        ? stored.splitPercent
        : null
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 200, box.y + box.height / 2, { steps: 6 })
    await expect(divider).not.toHaveAttribute('aria-valuenow', DEFAULT_SPLIT_PERCENT)
    expect(await storedSplit()).toBe(Number(DEFAULT_SPLIT_PERCENT))
    await page.mouse.up()
    await expect.poll(storedSplit).toBeLessThan(Number(DEFAULT_SPLIT_PERCENT))
  })

  test('layout radios switch modes from the preview header', async ({ page }) => {
    await page.goto('/')
    await layoutRadio(page, 'Docked').focus()
    await page.keyboard.press('ArrowRight')
    await expect(layoutRadio(page, 'Split')).toBeChecked()
    await page.keyboard.press('ArrowRight')
    await expect(layoutRadio(page, 'Full')).toBeChecked()
    await layoutRadio(page, 'Docked').click()
    await expect(layoutRadio(page, 'Docked')).toBeChecked()
  })

  test('checker room backdrop renders behind the preview mesh', async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    const viewportCanvas = preview(page).locator('canvas')
    await expect(viewportCanvas).toBeVisible()
    await expect(preview(page).getByText(/^(WebGPU|WebGL2)$/)).toBeVisible()
    await expect
      .poll(async () => cornerLuminanceSpread(page, await viewportCanvas.screenshot()))
      .toBeLessThan(UNIFORM_SPREAD_MAX)

    const backdrop = preview(page).getByRole('combobox', { name: 'Backdrop' })
    await backdrop.focus()
    // Type-ahead on the closed select picks the option that starts with the letter.
    await page.keyboard.press('c')
    await expect(backdrop).toHaveText('Checker room')
    await expect
      .poll(async () => cornerLuminanceSpread(page, await viewportCanvas.screenshot()))
      .toBeGreaterThan(CHECKER_SPREAD_MIN)

    await page.reload()
    await expect(preview(page).getByRole('combobox', { name: 'Backdrop' })).toHaveText(
      'Checker room',
    )
  })
})

test.describe('new graph', () => {
  test('new graph resets to master only after confirm, and undo restores', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    const newGraphButton = page.getByRole('button', { name: 'New graph', exact: true })
    await expect(page.getByRole('group', { name: 'Sine', exact: true })).toBeVisible()

    await newGraphButton.click()
    const dialog = page.getByRole('alertdialog', { name: 'Start a new graph?' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('2 nodes')
    // The safe choice has focus; Escape keeps everything and returns focus to the button.
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(newGraphButton).toBeFocused()
    await expect(page.getByRole('group', { name: 'Sine', exact: true })).toBeVisible()

    await page.keyboard.press('ControlOrMeta+Alt+KeyN')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Start new graph' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('group', { name: 'Sine', exact: true })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()
    await expect.poll(async () => (await readStoredNodes(page)).length).toBe(1)

    await canvas(page).focus()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.getByRole('group', { name: 'Sine', exact: true })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Time', exact: true })).toBeVisible()
  })

  test('a graph with only the master resets without asking', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New graph', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()
  })
})
