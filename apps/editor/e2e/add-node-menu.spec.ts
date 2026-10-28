import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectFocusRing, expectQuietFieldFocus } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import { COLOR_TO_BASE_COLOR, MASTER_POSITION, seedAutosave } from './support/seed-graph'

/** Mirrors the color node seeded by COLOR_TO_BASE_COLOR and the menu's sideways offset. */
const COLOR_POSITION = { x: 200, y: 40 }
const BESIDE_NODE_OFFSET_X = 260
/** The seeded master's left edge and its width (w-64), in flow units. */
const MASTER_RIGHT_EDGE_X = MASTER_POSITION.x + 256
/** An empty spot of the pane, left of the fitted nodes and above the zoom controls. */
const EMPTY_PANE_POINT = { x: 120, y: 360 }
const CURSOR_TOLERANCE_PX = 1

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

function addNodeMenu(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Add node' })
  const search = dialog.getByRole('combobox')
  return {
    dialog,
    search,
    searchGroup: dialog.locator('[data-slot="input-group"]'),
  }
}

async function storedPositionOf(page: Page, type: string): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.type === type)
  return node?.position ?? null
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    'y' in value &&
    typeof value.x === 'number' &&
    typeof value.y === 'number'
  )
}

async function waitForCanvas(page: Page): Promise<void> {
  await expect(page.locator('.react-flow__edge-path').first()).toBeVisible()
}

test.describe('add-node menu', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await waitForCanvas(page)
  })

  test('space opens menu, typing "fres" + Enter adds Fresnel and focuses it', async ({ page }) => {
    const color = graphNode(page, 'Color')
    await color.focus()
    await page.keyboard.press('Space')

    const { dialog, search } = addNodeMenu(page)
    await expect(dialog).toBeVisible()
    await expect(search).toBeFocused()
    await page.keyboard.type('fres')
    await expect(dialog.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    const fresnel = graphNode(page, 'Fresnel')
    await expect(fresnel).toBeVisible()
    await expectFocusRing(page, fresnel)
    // Placed beside the node that had focus when Space was pressed, on its row; the Master Stack
    // sits there, so the new node moves right past it instead of covering it.
    await expect.poll(() => storedPositionOf(page, 'effects/fresnel')).not.toBeNull()
    const position = await storedPositionOf(page, 'effects/fresnel')
    if (!isPoint(position)) throw new Error('Fresnel has no stored position')
    expect(position.y).toBe(COLOR_POSITION.y)
    expect(position.x).toBeGreaterThanOrEqual(COLOR_POSITION.x + BESIDE_NODE_OFFSET_X)
    expect(position.x).toBeGreaterThan(MASTER_RIGHT_EDGE_X)
  })

  test('escape closes and restores focus to the header button', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Add node', exact: true })
    await button.focus()
    await page.keyboard.press('Enter')

    const { dialog, search } = addNodeMenu(page)
    await expect(dialog).toBeVisible()
    await expect(search).toBeFocused()
    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(button).toBeFocused()
  })

  test('keyboard stays inside the menu and arrows move through the grouped list', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Add node', exact: true }).focus()
    await page.keyboard.press('Enter')
    const { dialog, search, searchGroup } = addNodeMenu(page)
    await expectQuietFieldFocus(page, search, searchGroup)

    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(search).toBeFocused()

    const options = dialog.getByRole('option')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowDown')
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(search).toHaveAttribute('aria-activedescendant', /.+/)
    await page.keyboard.press('End')
    await expect(options.last()).toHaveAttribute('aria-selected', 'true')
    await expect(dialog).toContainText('Glows where the surface turns away from the camera')
  })

  test('escape after space returns focus to the node that opened the menu', async ({ page }) => {
    const color = graphNode(page, 'Color')
    await color.focus()
    await page.keyboard.press('Space')
    await expect(addNodeMenu(page).dialog).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(addNodeMenu(page).dialog).toBeHidden()
    await expect(color).toBeFocused()
  })

  test('right-click on pane offers Add node…, which opens the menu', async ({ page }) => {
    const hitsPane = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('react-flow__pane'),
      EMPTY_PANE_POINT,
    )
    expect(hitsPane).toBe(true)

    await page.mouse.click(EMPTY_PANE_POINT.x, EMPTY_PANE_POINT.y, { button: 'right' })
    await page.getByRole('menuitem', { name: /^Add node…/ }).click()

    const { dialog, search } = addNodeMenu(page)
    await expect(dialog).toBeVisible()
    await expect(search).toBeFocused()
    await search.fill('time')
    await page.keyboard.press('Enter')

    // The new node's top-left corner lands on the cursor.
    const time = graphNode(page, 'Time')
    await expect(time).toBeFocused()
    const box = await time.boundingBox()
    if (box === null) throw new Error('Time node has no bounding box')
    expect(Math.abs(box.x - EMPTY_PANE_POINT.x)).toBeLessThanOrEqual(CURSOR_TOLERANCE_PX)
    expect(Math.abs(box.y - EMPTY_PANE_POINT.y)).toBeLessThanOrEqual(CURSOR_TOLERANCE_PX)
  })

  test('escape after right-click returns focus to the canvas', async ({ page }) => {
    await page.mouse.click(EMPTY_PANE_POINT.x, EMPTY_PANE_POINT.y, { button: 'right' })
    await page.getByRole('menuitem', { name: /^Add node…/ }).click()
    await expect(addNodeMenu(page).dialog).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(addNodeMenu(page).dialog).toBeHidden()
    await expect(page.getByRole('main', { name: 'Node canvas' })).toBeFocused()
  })

  test('space inside a text field types a space instead of opening the menu', async ({ page }) => {
    const roughness = graphNode(page, 'Master Stack').getByRole('textbox', { name: 'Roughness' })
    await roughness.focus()
    await page.keyboard.press('Space')

    await expect(addNodeMenu(page).dialog).toHaveCount(0)
    await expect(roughness).toBeFocused()
  })

  test('a search with no match says so', async ({ page }) => {
    await page.getByRole('button', { name: 'Add node', exact: true }).click()
    const { dialog, search } = addNodeMenu(page)
    await search.fill('zzz')

    await expect(dialog.getByRole('option')).toHaveCount(0)
    await expect(dialog).toContainText('No nodes match "zzz"')
  })
})
