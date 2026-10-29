import { expect, test, type Page } from '@playwright/test'

import { expectFocusRing, tabUntilFocused } from './support/focus-indicators'
import { addNodeFromHeader } from './support/graph-keyboard'
import { examplesButton, pickExampleByKeyboard } from './support/open-example'
import { readStoredNodes } from './support/read-autosave'
import { TIME_TO_SINE, seedAutosave } from './support/seed-graph'
import { stillTransforms } from './support/still-transforms'
import type { StillOptions } from './support/still-transforms'

const PALETTE_CHORD = 'ControlOrMeta+k'
const UNDO_CHORD = 'ControlOrMeta+z'
/** The iridescent blob: 20 nodes, five comment frames and the master. */
const BLOB_NODE_COUNT = 26
/** Frames (about half a second) the view must hold still: a fit that was going to happen has started by then. */
const NO_FIT_STILL_FRAMES = 30

function confirmDialog(page: Page) {
  return page.getByRole('alertdialog')
}

/** The canvas pan and zoom, as React Flow writes it on the viewport layer. */
async function viewportTransform(page: Page): Promise<string> {
  return page
    .locator('.react-flow__viewport')
    .evaluate((element) => getComputedStyle(element).transform)
}

/** Waits until the view stops moving (a fit glides), then returns where it settled. */
async function settledViewport(page: Page, options: StillOptions = {}): Promise<string> {
  const [transform] = await stillTransforms(page, ['.react-flow__viewport'], options)
  return transform ?? ''
}

async function storedNodeIds(page: Page): Promise<readonly string[]> {
  return (await readStoredNodes(page)).map((node) => node.id).sort()
}

interface Box {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The rendered boxes of every graph node (not comment frames), in screen pixels. */
async function renderedNodeBoxes(page: Page): Promise<readonly Box[]> {
  return page.locator('.react-flow__node:not(.react-flow__node-comment)').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        id: node.getAttribute('data-id') ?? '',
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }
    }),
  )
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test.describe('examples', () => {
  test('the Examples menu opens an example on an empty graph with the keyboard alone', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()

    await pickExampleByKeyboard(page, 'Iridescent blob')

    await expect(confirmDialog(page)).toBeHidden()
    await expect(page.locator('.react-flow__node')).toHaveCount(BLOB_NODE_COUNT)
    await expect(examplesButton(page)).toBeFocused()
    await expect(
      page.getByRole('group', { name: '1 · Animated noise', exact: true }),
    ).toBeAttached()
    await expect(page.getByRole('radio', { name: 'Knot', exact: true })).toBeChecked()
    await expect(page.locator('[data-error="true"]')).toHaveCount(0)
  })

  for (const title of ['Iridescent blob', 'Pond']) {
    test(`lays the ${title} out with its previews on, no node over another`, async ({ page }) => {
      await page.goto('/')
      await pickExampleByKeyboard(page, title)
      // A preview frame takes its full size from the start, drawn or not.
      await expect(page.locator('[data-preview-status]').first()).toBeVisible()

      const boxes = await renderedNodeBoxes(page)
      expect(boxes.length).toBeGreaterThan(0)
      const collisions = boxes.flatMap((box, index) =>
        boxes
          .slice(index + 1)
          .flatMap((other) => (overlaps(box, other) ? [[box.id, other.id]] : [])),
      )
      expect(collisions).toEqual([])
    })
  }

  test('opening the same example twice frames it once, and adding a node then leaves the view alone', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()
    await pickExampleByKeyboard(page, 'Iridescent blob')
    await expect(
      page.getByRole('group', { name: '1 · Animated noise', exact: true }),
    ).toBeAttached()
    const framed = await settledViewport(page)

    // Pan away, so the second opening has to frame the example again to land there.
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press('Shift+ArrowRight')
    expect(await settledViewport(page)).not.toBe(framed)

    // Every node of the second copy has the same id as one the canvas already measured.
    await pickExampleByKeyboard(page, 'Iridescent blob')
    await confirmDialog(page).getByRole('button', { name: 'Open example' }).click()
    await expect(confirmDialog(page)).toBeHidden()
    await expect.poll(() => viewportTransform(page)).toBe(framed)

    await addNodeFromHeader(page, 'sine', 'Sine')
    expect(await settledViewport(page, { stillFrames: NO_FIT_STILL_FRAMES })).toBe(framed)
  })

  test('Tab reaches the menu button with a visible ring; Escape closes the menu back onto it', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('group', { name: 'Master Stack', exact: true })).toBeVisible()
    await tabUntilFocused(page, examplesButton(page))
    await expectFocusRing(page, examplesButton(page))

    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu', { name: 'Examples' })
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(examplesButton(page)).toBeFocused()
  })

  test('the confirmation keeps Tab inside it and, once confirmed, gives focus back', async ({
    page,
  }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(1)

    await pickExampleByKeyboard(page, 'Iridescent blob')
    const dialog = confirmDialog(page)
    const cancel = dialog.getByRole('button', { name: 'Cancel' })
    const confirm = dialog.getByRole('button', { name: 'Open example' })
    await expect(cancel).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cancel).toBeFocused()

    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page.locator('.react-flow__node')).toHaveCount(BLOB_NODE_COUNT)
    await expect(examplesButton(page)).toBeFocused()
  })

  test('asks first when the graph has work in it; Escape keeps the graph and returns focus', async ({
    page,
  }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(1)
    const before = await storedNodeIds(page)

    await pickExampleByKeyboard(page, 'Iridescent blob')
    const dialog = confirmDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Open “Iridescent blob”?')
    await expect(dialog).toContainText('2 nodes')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(examplesButton(page)).toBeFocused()
    expect(await storedNodeIds(page)).toEqual(before)
  })

  test('confirming replaces the graph as one undo step', async ({ page }) => {
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await expect(page.locator('.react-flow__edge-path')).toHaveCount(1)
    const before = await storedNodeIds(page)

    await pickExampleByKeyboard(page, 'Iridescent blob')
    await confirmDialog(page).getByRole('button', { name: 'Open example' }).click()
    await expect(confirmDialog(page)).toBeHidden()
    await expect(page.locator('.react-flow__node')).toHaveCount(BLOB_NODE_COUNT)
    await expect.poll(() => storedNodeIds(page)).not.toEqual(before)

    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press(UNDO_CHORD)
    await expect.poll(() => storedNodeIds(page)).toEqual(before)
  })

  test('⌘K lists the examples and opens one; in Spanish the frames speak Spanish', async ({
    page,
  }) => {
    await page.goto('/')
    await page
      .getByRole('banner')
      .getByRole('button', { name: /^Language/ })
      .click()
    await page.getByRole('menuitemradio', { name: 'Español' }).click()
    // The closing menu hands focus back to its button: wait for that before moving it on, or
    // the menu takes it back and Ctrl/⌘ K lands inside an overlay that is still closing.
    await expect(page.getByRole('menu')).toBeHidden()
    await expect(page.getByRole('banner').getByRole('button', { name: /^Idioma/ })).toBeFocused()
    const canvas = page.getByRole('main', { name: 'Lienzo de nodos' })
    await canvas.focus()
    await expect(canvas).toBeFocused()

    await page.keyboard.press(PALETTE_CHORD)
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('combobox') })
    await expect(dialog).toBeVisible()
    await page.keyboard.type('blob')
    await expect(dialog.getByRole('option').first()).toContainText(
      'Abrir ejemplo: Blob iridiscente',
    )
    await page.keyboard.press('Enter')

    const frame = page.getByRole('group', { name: '1 · Noise animado', exact: true })
    await expect(frame.getByRole('textbox', { name: 'Texto del comentario' })).toHaveValue(
      /se desliza con el tiempo/,
    )
  })
})
