import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectFocusRing, tabUntilFocused } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import {
  COLOR_TO_BASE_COLOR,
  TIME_AND_SINE,
  TIME_TO_SINE,
  seedAutosave,
} from './support/seed-graph'

const NOT_NUDO_NOTICE = "Clipboard doesn't contain nudo-tsl nodes"
const ARROW_PRESSES = 3
const ARROW_STEP_PX = 10
const SHIFT_ARROW_STEP_PX = 50
const PAN_STEP_PX = 40
const SHIFT_PAN_STEP_PX = 160
const TIME_START = { x: 0, y: 100 }
const ORIGINAL_NODE_IDS = ['master', 'time', 'sine']

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

function portButton(node: Locator, name: RegExp): Locator {
  return node.getByRole('button', { name })
}

function edges(page: Page): Locator {
  return page.locator('.react-flow__edge-path')
}

function notice(page: Page): Locator {
  return page.getByRole('status')
}

async function openCanvas(page: Page, document: string): Promise<void> {
  await seedAutosave(page, document)
  await page.goto('/')
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
}

async function storedPosition(page: Page, nodeId: string): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  return node?.position ?? null
}

/** The viewport translation React Flow applies, in pixels. */
async function viewportOffset(page: Page): Promise<{ x: number; y: number }> {
  return page.locator('.react-flow__viewport').evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform)
    return { x: matrix.e, y: matrix.f }
  })
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test.describe('keyboard connect', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
  })

  test('connect Time to Sin using only the keyboard', async ({ page }) => {
    const outputPort = portButton(graphNode(page, 'Time'), /^Out, output port/)
    await tabUntilFocused(page, outputPort)
    await expectFocusRing(page, outputPort)
    await expect(edges(page)).toHaveCount(0)

    await page.keyboard.press('Enter')
    const list = page.getByRole('dialog', { name: 'Connect Time › Out' })
    await expect(list).toBeVisible()
    await page.keyboard.type('sin')
    await expect(list.getByRole('option')).toHaveCount(1)
    await expect(list.getByRole('option', { name: 'Sine › In · float' })).toBeVisible()
    await page.keyboard.press('Enter')

    await expect(list).toBeHidden()
    await expect(edges(page)).toHaveCount(1)
    await expect(page.getByRole('group', { name: 'Time Out to Sine In' })).toBeAttached()
    await expect(outputPort).toBeFocused()
  })

  test('escape closes the connect list and returns focus to the port', async ({ page }) => {
    const inputPort = portButton(graphNode(page, 'Sine'), /^In, input port/)
    await tabUntilFocused(page, inputPort)

    await page.keyboard.press('Enter')
    const list = page.getByRole('dialog', { name: 'Connect Sine › In' })
    await expect(list.getByRole('option', { name: 'Time › Out · float' })).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(list).toBeHidden()
    await expect(inputPort).toBeFocused()
    await expect(edges(page)).toHaveCount(0)
  })
})

test.describe('node keyboard model', () => {
  test('arrow keys move the focused node and a single undo restores it', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    const time = graphNode(page, 'Time')
    await time.focus()

    for (let press = 0; press < ARROW_PRESSES; press += 1) await page.keyboard.down('ArrowRight')
    await page.keyboard.up('ArrowRight')

    await expect
      .poll(() => storedPosition(page, 'time'))
      .toEqual({ x: TIME_START.x + ARROW_PRESSES * ARROW_STEP_PX, y: TIME_START.y })

    await page.keyboard.press('Control+Z')

    await expect.poll(() => storedPosition(page, 'time')).toEqual(TIME_START)
  })

  test('shift plus arrow moves 50 px', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    await graphNode(page, 'Time').focus()

    await page.keyboard.press('Shift+ArrowDown')

    await expect
      .poll(() => storedPosition(page, 'time'))
      .toEqual({ x: TIME_START.x, y: TIME_START.y + SHIFT_ARROW_STEP_PX })
  })

  test('delete on the master shows a notice and keeps it', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const master = graphNode(page, 'Master Stack')
    await master.focus()

    await page.keyboard.press('Delete')

    await expect(notice(page)).toContainText("The Master Stack can't be deleted.")
    await expect(master).toBeVisible()
  })

  test('delete removes the focused node with its edge, and one undo brings both back', async ({
    page,
  }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    await graphNode(page, 'Color').focus()

    await page.keyboard.press('Delete')

    await expect(graphNode(page, 'Color')).toHaveCount(0)
    await expect(edges(page)).toHaveCount(0)

    await page.keyboard.press('Control+Z')

    await expect(graphNode(page, 'Color')).toBeVisible()
    await expect(edges(page)).toHaveCount(1)
  })

  test('delete on a connected port disconnects it', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const baseColor = portButton(graphNode(page, 'Master Stack'), /^Base Color, input port/)
    await tabUntilFocused(page, baseColor)
    await expect(baseColor).toHaveAccessibleName(/connected/)

    await page.keyboard.press('Delete')

    await expect(edges(page)).toHaveCount(0)
    await expect(graphNode(page, 'Color')).toBeVisible()
  })

  test('escape in a field reverts what was typed and returns to the node', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const master = graphNode(page, 'Master Stack')
    const roughness = master.getByRole('textbox', { name: 'Roughness' })
    await roughness.focus()
    await page.keyboard.type('0.9')

    await page.keyboard.press('Escape')

    await expect(master).toBeFocused()
    await expect(roughness).toHaveValue('0.5')
  })

  test('enter opens the first field and escape returns to the node', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const master = graphNode(page, 'Master Stack')
    await master.focus()

    await page.keyboard.press('Enter')
    // The master's first field is its Lighting setting.
    await expect(master.getByRole('combobox', { name: 'Lighting' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(master).toBeFocused()
  })
})

test.describe('node without fields', () => {
  test('enter moves focus to the first port', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    const time = graphNode(page, 'Time')
    await expect(time.locator('input')).toHaveCount(0)
    await time.focus()

    await page.keyboard.press('Enter')

    await expect(portButton(time, /^Out, output port/)).toBeFocused()
  })
})

test.describe('canvas panning', () => {
  test('arrow keys pan the view 40 px, shift 160 px, when the canvas is focused', async ({
    page,
  }) => {
    await openCanvas(page, TIME_AND_SINE)
    await page.locator('#node-canvas').focus()
    const start = await viewportOffset(page)

    await page.keyboard.press('ArrowRight')
    await expect
      .poll(async () => (await viewportOffset(page)).x)
      .toBeCloseTo(start.x - PAN_STEP_PX, 1)

    await page.keyboard.press('Shift+ArrowDown')
    await expect
      .poll(async () => (await viewportOffset(page)).y)
      .toBeCloseTo(start.y - SHIFT_PAN_STEP_PX, 1)
  })

  test('space no longer pans: it opens the add-node menu on the canvas', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    await page.locator('#node-canvas').focus()

    await page.keyboard.press('Space')

    await expect(page.getByRole('dialog', { name: 'Add node' })).toBeVisible()
  })
})

test.describe('clipboard', () => {
  test('copy/paste duplicates selected nodes with internal edge', async ({ page }) => {
    await openCanvas(page, TIME_TO_SINE)
    await graphNode(page, 'Time').focus()
    await expect(edges(page)).toHaveCount(1)

    await page.keyboard.press('Control+A')
    await page.keyboard.press('Control+C')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('nudo-tsl/fragment')
    await page.keyboard.press('Control+V')

    await expect(graphNode(page, 'Time')).toHaveCount(2)
    await expect(graphNode(page, 'Sine')).toHaveCount(2)
    await expect(graphNode(page, 'Master Stack')).toHaveCount(1)
    await expect(edges(page)).toHaveCount(2)

    // Focus lands on one of the pasted copies, never on an original node.
    const focusedNode = page.locator('.react-flow__node:focus')
    await expect(focusedNode).toHaveCount(1)
    expect(ORIGINAL_NODE_IDS).not.toContain(await focusedNode.getAttribute('data-id'))
  })

  test('pasting prose shows notice and leaves graph unchanged', async ({ page }) => {
    await openCanvas(page, TIME_TO_SINE)
    await graphNode(page, 'Time').focus()
    await page.evaluate(() => navigator.clipboard.writeText('Just a sentence, not a graph.'))
    const nodeCount = await page.locator('.react-flow__node').count()

    await page.keyboard.press('Control+V')

    await expect(notice(page)).toContainText(NOT_NUDO_NOTICE)
    await expect(page.locator('.react-flow__node')).toHaveCount(nodeCount)
    await expect(edges(page)).toHaveCount(1)
  })
})

test.describe('shortcuts dialog', () => {
  test('? opens shortcuts dialog; Escape closes and restores focus', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    const time = graphNode(page, 'Time')
    await time.focus()

    await page.keyboard.press('?')

    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('table')).toBeVisible()
    await expect(dialog.getByRole('row', { name: /Undo/ })).toBeVisible()
    await expect(dialog.getByRole('row', { name: /Paste/ })).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(time).toBeFocused()
  })

  test('shortcuts are ignored while typing in a text field', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const roughness = graphNode(page, 'Master Stack').getByRole('textbox', { name: 'Roughness' })
    await roughness.focus()

    await page.keyboard.press('?')
    await page.keyboard.press('f')

    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
