import { expect, test, type Locator, type Page } from '@playwright/test'

import { centerColor, colorDistance } from './support/center-color'
import { expectFocusRing, tabUntilFocused } from './support/focus-indicators'
import { traceAppearance } from './support/motion-trace'
import {
  selectTemplateByKeyboard,
  templateTitles,
  templatesBrowser,
  templatesButton,
} from './support/open-example'
import { readStoredNodes } from './support/read-autosave'
import { TIME_TO_SINE, seedAutosave } from './support/seed-graph'

const PALETTE_CHORD = 'ControlOrMeta+k'
const UNDO_CHORD = 'ControlOrMeta+z'
const SHEET = '[data-slot="sheet-content"]'
const BLOB = 'Iridescent blob'
/** The iridescent blob on the canvas: 20 nodes, five comment frames and the master. */
const BLOB_NODE_COUNT = 26
/** Two different templates on two different meshes read as clearly different colors. */
const MIN_COLOR_DISTANCE = 30
/** A shader compile in software WebGL (the pond is large) can take a while. */
const PREVIEW_TIMEOUT_MS = 60_000

function preview(page: Page): Locator {
  return templatesBrowser(page).locator('[data-template-preview]')
}

/** Waits until the preview draws a template other than `previous`, and returns which one. */
async function shownTemplate(page: Page, previous: string | null = null): Promise<string> {
  const ready = preview(page).and(page.locator('[data-status="ready"]'))
  await expect(ready).toBeVisible({ timeout: PREVIEW_TIMEOUT_MS })
  if (previous !== null) {
    await expect(ready).not.toHaveAttribute('data-shown-template', previous, {
      timeout: PREVIEW_TIMEOUT_MS,
    })
  }
  return (await preview(page).getAttribute('data-shown-template')) ?? ''
}

async function storedNodeIds(page: Page): Promise<readonly string[]> {
  return (await readStoredNodes(page)).map((node) => node.id).sort()
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()
}

test.describe('templates browser', () => {
  test('the header button opens it on a template; Escape closes it back onto the button', async ({
    page,
  }) => {
    await openEditor(page)

    await templatesButton(page).click()
    const browser = templatesBrowser(page)
    await expect(browser).toBeVisible()
    await expect(browser.getByRole('listbox', { name: 'Templates' })).toBeVisible()
    await expect(browser.getByRole('option', { selected: true })).toBeFocused()
    await expect(browser.getByRole('button', { name: 'Open template' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(browser).toBeHidden()
    await expect(templatesButton(page)).toBeFocused()
  })

  test('⌘K browses the templates, and a template command opens the browser on it', async ({
    page,
  }) => {
    await openEditor(page)
    const canvas = page.getByRole('main', { name: 'Node canvas' })
    const palette = page.getByRole('dialog').filter({ has: page.getByRole('combobox') })
    const browser = templatesBrowser(page)

    await canvas.focus()
    await page.keyboard.press(PALETTE_CHORD)
    await page.keyboard.type('browse templates')
    await expect(palette.getByRole('option').first()).toContainText('Browse templates')
    await page.keyboard.press('Enter')
    await expect(browser).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(browser).toBeHidden()
    await expect(canvas).toBeFocused()

    await page.keyboard.press(PALETTE_CHORD)
    await page.keyboard.type('blob')
    await expect(palette.getByRole('option').first()).toContainText(`Template: ${BLOB}`)
    await page.keyboard.press('Enter')
    await expect(browser.getByRole('option', { name: BLOB })).toBeFocused()
    await expect(browser.getByRole('option', { name: BLOB })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // Choosing it in the palette shows it; nothing on the canvas changed.
    await expect(page.locator('.react-flow__node')).toHaveCount(1)
  })

  test('arrowing to another template changes the live preview', async ({ page }) => {
    // Two shader compiles in software WebGL, one of them possibly the large pond.
    test.slow()
    await openEditor(page)
    await templatesButton(page).click()
    const canvas = preview(page).locator('canvas')

    const first = await shownTemplate(page)
    const firstColor = await centerColor(page, await canvas.screenshot())

    await selectTemplateByKeyboard(page, BLOB)
    const second = await shownTemplate(page, first)
    const secondColor = await centerColor(page, await canvas.screenshot())

    expect(second).not.toBe(first)
    expect(colorDistance(firstColor, secondColor)).toBeGreaterThan(MIN_COLOR_DISTANCE)
  })

  test('typing a title selects it', async ({ page }) => {
    await openEditor(page)
    await templatesButton(page).click()
    const browser = templatesBrowser(page)
    await expect(browser.getByRole('option', { selected: true })).toBeFocused()

    await page.keyboard.type('iri')
    await expect(browser.getByRole('option', { name: BLOB })).toBeFocused()
    await expect(browser.getByRole('option', { name: BLOB })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('keyboard only: Tab to the button, pick a template, open it, focus comes back', async ({
    page,
  }) => {
    await openEditor(page)
    await tabUntilFocused(page, templatesButton(page))
    await expectFocusRing(page, templatesButton(page))

    await page.keyboard.press('Enter')
    const browser = templatesBrowser(page)
    await expect(browser.getByRole('option', { selected: true })).toBeFocused()
    await selectTemplateByKeyboard(page, BLOB)
    const openButton = browser.getByRole('button', { name: 'Open template' })
    // Tab stays inside the sheet on its way to the button.
    await tabUntilFocused(page, openButton)
    await expectFocusRing(page, openButton)
    await page.keyboard.press('Enter')

    await expect(browser).toBeHidden()
    await expect(page.locator('.react-flow__node')).toHaveCount(BLOB_NODE_COUNT)
    await expect(templatesButton(page)).toBeFocused()
  })

  test('opening over work asks first, then replaces the graph as one undo step', async ({
    page,
  }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(1)
    const before = await storedNodeIds(page)

    await templatesButton(page).click()
    const browser = templatesBrowser(page)
    await browser.getByRole('option', { name: BLOB }).click()
    const openButton = browser.getByRole('button', { name: 'Open template' })
    await openButton.click()

    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText(`Open “${BLOB}”?`)
    // Cancelling keeps the graph and the browser, focus back on the button that asked.
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(confirm).toBeHidden()
    await expect(openButton).toBeFocused()
    expect(await storedNodeIds(page)).toEqual(before)

    await openButton.click()
    await confirm.getByRole('button', { name: 'Open template' }).click()
    await expect(browser).toBeHidden()
    await expect(page.locator('.react-flow__node')).toHaveCount(BLOB_NODE_COUNT)
    await expect(page.getByRole('radio', { name: 'Knot', exact: true })).toBeChecked()
    await expect.poll(() => storedNodeIds(page)).not.toEqual(before)

    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press(UNDO_CHORD)
    await expect.poll(() => storedNodeIds(page)).toEqual(before)
  })

  test('at 390px the sheet takes the full width with the preview above the list', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openEditor(page)

    // The narrow header has no Templates button; the palette browses them.
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press(PALETTE_CHORD)
    await page.keyboard.type('browse templates')
    await page.keyboard.press('Enter')
    const browser = templatesBrowser(page)
    await expect(browser).toBeVisible()
    const sheet = await browser.boundingBox()
    const previewBox = await preview(page).boundingBox()
    const listBox = await browser.getByRole('listbox').boundingBox()
    if (sheet === null || previewBox === null || listBox === null) throw new Error('No layout')
    expect(sheet.width).toBe(390)
    expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(listBox.y + 1)

    const titles = await templateTitles(page)
    const last = titles.at(-1) ?? ''
    await browser.getByRole('option', { name: last }).click()
    await expect(browser.getByRole('option', { name: last })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(browser.getByRole('button', { name: 'Open template' })).toBeInViewport()
    await expect(browser.getByRole('button', { name: 'Cancel' })).toBeInViewport()
  })
})

test.describe('templates browser lifetime', () => {
  /** More than Chrome's 16 live WebGL contexts: a leaked renderer per opening would show. */
  const OPEN_CLOSE_CYCLES = 18
  /** The default material's light gray sphere, lit, against the dark theme's background. */
  const MIN_SPHERE_CHANNEL = 100

  test('opening and closing it many times leaks no renderer', async ({ page }) => {
    test.slow()
    const contextWarnings: string[] = []
    page.on('console', (message) => {
      if (/too many active webgl contexts|context lost/i.test(message.text())) {
        contextWarnings.push(message.text())
      }
    })
    await openEditor(page)

    for (let cycle = 0; cycle < OPEN_CLOSE_CYCLES; cycle += 1) {
      await templatesButton(page).click()
      await shownTemplate(page)
      await page.keyboard.press('Escape')
      await expect(page.locator(SHEET)).toHaveCount(0)
    }

    expect(contextWarnings).toEqual([])
    // The Main Preview's context survived: its white sphere still fills the middle of the frame.
    const mainCanvas = page.getByRole('region', { name: 'Main preview' }).locator('canvas')
    const [red, green, blue] = await centerColor(page, await mainCanvas.screenshot())
    expect(Math.min(red, green, blue)).toBeGreaterThan(MIN_SPHERE_CHANNEL)
  })
})

test.describe('templates browser motion', () => {
  test.describe('with motion enabled', () => {
    test.use({ reducedMotion: 'no-preference' })

    test('a pointer opens it with the panel reveal; Enter opens it at once', async ({ page }) => {
      await openEditor(page)

      const byPointer = await traceAppearance(page, SHEET, () => templatesButton(page).click())
      expect(byPointer.samples[0]?.hasTransform).toBe(true)
      expect(byPointer.samples[0]?.filter).toContain('blur')
      expect(byPointer.settledAtMs).not.toBeNull()
      await page.keyboard.press('Escape')
      await expect(page.locator(SHEET)).toHaveCount(0)

      await templatesButton(page).focus()
      const byKey = await traceAppearance(page, SHEET, () => page.keyboard.press('Enter'))
      for (const sample of byKey.samples) {
        expect(sample.opacity).toBe(1)
        expect(sample.hasTransform).toBe(false)
        expect(sample.runningAnimations).toBe(0)
      }
    })
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('reduced motion: the sheet only fades (no transform)', async ({ page }) => {
      await openEditor(page)

      const trace = await traceAppearance(page, SHEET, () => templatesButton(page).click())
      expect(trace.samples[0]?.opacity).toBe(0)
      expect(trace.samples.at(-1)?.opacity).toBe(1)
      for (const sample of trace.samples) {
        expect(sample.hasTransform).toBe(false)
        expect(sample.filter).toBe('none')
      }
    })
  })
})
