import { expect, test, type Locator, type Page } from '@playwright/test'
import { AUTOSAVE_KEY, COLOR_TO_BASE_COLOR, seedAutosave } from './support/seed-graph'

const VEC3_COLOR = 'oklch(0.82 0.16 80)'
const DRAG_OFFSET = { x: 160, y: 90 }
const DRAG_STEPS = 8
const MAX_TAB_PRESSES = 30

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

function port(node: Locator, portId: string): Locator {
  return node.locator(`[data-port-id="${portId}"]`)
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Element has no bounding box')
  return { x: box.x, y: box.y }
}

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Element has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** React Flow tracks pointer moves, so the drag needs intermediate steps. */
async function dragWithMouse(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await centerOf(from)
  const end = await centerOf(to)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: DRAG_STEPS })
  await page.mouse.up()
}

/** Resolves once React Flow has measured the nodes and fitted the view, so boxes stop moving. */
async function waitForSettledLayout(page: Page, node: Locator): Promise<void> {
  await expect(page.locator('.react-flow__edge-path').first()).toBeVisible()
  let previous = await boxOf(node)
  await expect
    .poll(async () => {
      const current = await boxOf(node)
      const isStable = current.x === previous.x && current.y === previous.y
      previous = current
      return isStable
    })
    .toBe(true)
}

test.describe('seeded canvas', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
  })

  test('renders master stack and color node with typed ports', async ({ page }) => {
    const master = graphNode(page, 'Master Stack')
    const color = graphNode(page, 'Color')
    await expect(master).toBeVisible()
    await expect(color).toBeVisible()

    await expect(master.getByRole('heading', { name: 'Vertex' })).toBeVisible()
    await expect(master.getByRole('heading', { name: 'Fragment' })).toBeVisible()
    await expect(port(color, 'out')).toContainText('3')
    await expect(port(master, 'baseColor')).toContainText('3')
    await expect(port(master, 'roughness')).toContainText('1')

    // Base Color is driven by the edge, so it has no inline field; Roughness is unconnected.
    await expect(port(master, 'baseColor').getByRole('textbox')).toHaveCount(0)
    await expect(master.getByRole('textbox', { name: 'Roughness' })).toHaveValue('0.5')

    const edgePath = page.locator('.react-flow__edge-path')
    await expect(edgePath).toHaveCount(1)
    await expect(edgePath).toHaveCSS('stroke', VEC3_COLOR)
  })

  test('dragging a node then undo returns it', async ({ page }) => {
    const color = graphNode(page, 'Color')
    const header = color.getByRole('heading', { name: 'Color', exact: true })
    await waitForSettledLayout(page, color)
    const start = await boxOf(color)
    const grab = await header.boundingBox()
    if (grab === null) throw new Error('Header has no bounding box')

    await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      grab.x + grab.width / 2 + DRAG_OFFSET.x,
      grab.y + grab.height / 2 + DRAG_OFFSET.y,
      { steps: DRAG_STEPS },
    )
    await page.mouse.up()

    await expect.poll(async () => (await boxOf(color)).x - start.x).toBeGreaterThan(50)

    await page.keyboard.press('Control+Z')

    await expect.poll(async () => Math.round((await boxOf(color)).x - start.x)).toBe(0)
    await expect.poll(async () => Math.round((await boxOf(color)).y - start.y)).toBe(0)
  })

  test('invalid number entry reverts on blur', async ({ page }) => {
    const roughness = graphNode(page, 'Master Stack').getByRole('textbox', { name: 'Roughness' })

    await roughness.fill('abc')
    await roughness.blur()
    await expect(roughness).toHaveValue('0.5')

    await roughness.fill('1e999')
    await roughness.press('Enter')
    await expect(roughness).toHaveValue('0.5')

    await roughness.fill('-')
    await roughness.press('Escape')
    await expect(roughness).toHaveValue('0.5')

    await roughness.fill('0.25')
    await roughness.press('Enter')
    await expect(roughness).toHaveValue('0.25')
  })

  test('arrow keys step a number field', async ({ page }) => {
    const roughness = graphNode(page, 'Master Stack').getByRole('textbox', { name: 'Roughness' })

    await roughness.focus()
    await roughness.press('ArrowUp')
    await expect(roughness).toHaveValue('0.6')
    await roughness.press('Shift+ArrowDown')
    await expect(roughness).toHaveValue('-0.4')
  })

  test('nodes are reachable with Tab and show the focus ring', async ({ page }) => {
    const master = graphNode(page, 'Master Stack')
    await expect(master).toBeVisible()

    for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
      await page.keyboard.press('Tab')
      const isFocused = await master.evaluate((element) => element === document.activeElement)
      if (isFocused) break
    }

    await expect(master).toBeFocused()
    await expect(master).toHaveCSS('outline-style', 'solid')
    await expect(master).toHaveCSS('outline-width', '2px')
  })
  test('dragging between ports connects them and deleting the edge disconnects', async ({
    page,
  }) => {
    const color = graphNode(page, 'Color')
    const master = graphNode(page, 'Master Stack')
    await waitForSettledLayout(page, color)
    const edges = page.locator('.react-flow__edge')
    await expect(edges).toHaveCount(1)

    await dragWithMouse(
      page,
      port(color, 'out').locator('.react-flow__handle'),
      port(master, 'emission').locator('.react-flow__handle'),
    )
    await expect(edges).toHaveCount(2)
    await expect(port(master, 'emission').getByRole('textbox')).toHaveCount(0)

    // React Flow selects a focused edge with Enter; Delete then removes the selection.
    await page.getByRole('group', { name: 'Color Out to Master Stack Emission' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Delete')
    await expect(edges).toHaveCount(1)

    await page.keyboard.press('Control+Z')
    await expect(edges).toHaveCount(2)
  })

  test('picking a color stores the linear value', async ({ page }) => {
    const swatch = graphNode(page, 'Master Stack').getByLabel('Emission', { exact: true })

    await swatch.fill('#00ff00')

    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY))
      .toContain(
        '"emission": {\n          "type": "vec3",\n          "value": [\n            0,\n            1,\n            0\n          ]',
      )
  })
})

test('a corrupt autosave shows a dismissible notice', async ({ page }) => {
  await seedAutosave(page, '{not json')
  await page.goto('/')

  const notice = page.getByRole('status')
  await expect(notice).toContainText("Couldn't restore your last session")
  await expect(graphNode(page, 'Master Stack')).toBeVisible()

  await notice.getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice).toBeEmpty()
})
