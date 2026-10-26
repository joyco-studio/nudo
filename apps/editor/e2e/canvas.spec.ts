import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectFocusRing, expectQuietFieldFocus, tabUntilFocused } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import { COLOR_TO_BASE_COLOR, seedAutosave } from './support/seed-graph'

const VEC3_COLOR = 'oklch(0.82 0.16 80)'
const DRAG_OFFSET = { x: 160, y: 90 }
const DRAG_STEPS = 8
const ANCHOR_TOLERANCE_PX = 0.5

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

/**
 * Where React Flow attaches an edge to a handle: the handle's vertical center on its outer edge
 * (left edge for inputs, right edge for outputs), in viewport pixels.
 */
async function handleAnchor(
  portRow: Locator,
  side: 'input' | 'output',
): Promise<{ x: number; y: number }> {
  const box = await portRow.locator('.react-flow__handle').boundingBox()
  if (box === null) throw new Error('Handle has no bounding box')
  return { x: side === 'input' ? box.x : box.x + box.width, y: box.y + box.height / 2 }
}

/** First and last point of an SVG edge path, in viewport pixels. */
async function edgeEndpoints(
  path: Locator,
): Promise<[{ x: number; y: number }, { x: number; y: number }]> {
  return path.evaluate((element) => {
    if (!(element instanceof SVGPathElement)) throw new Error('Not an SVG path')
    const matrix = element.getScreenCTM()
    if (matrix === null) throw new Error('Path is not rendered')
    const toViewport = (point: DOMPoint) => {
      const { x, y } = point.matrixTransform(matrix)
      return { x, y }
    }
    return [
      toViewport(element.getPointAtLength(0)),
      toViewport(element.getPointAtLength(element.getTotalLength())),
    ]
  })
}

/** Reads one inline value from the autosave document in localStorage. */
async function storedInputValue(page: Page, nodeId: string, portId: string): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  return node?.inputValues[portId] ?? null
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
    await expect(master.getByRole('group', { name: 'Fragment' })).toContainText('Base Color')
    await expect(page.getByRole('region', { name: 'Fragment' })).toHaveCount(0)
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

    await tabUntilFocused(page, master)
    await expectFocusRing(page, master)
  })

  test('number fields show a quiet border on focus; the color swatch keeps the ring', async ({
    page,
  }) => {
    const master = graphNode(page, 'Master Stack')
    const roughness = master.getByRole('textbox', { name: 'Roughness' })
    await tabUntilFocused(page, roughness)
    await expectQuietFieldFocus(page, roughness)

    const emission = master.getByLabel('Emission', { exact: true })
    await master.focus()
    await tabUntilFocused(page, emission)
    await expectFocusRing(page, emission)
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
      .poll(() => storedInputValue(page, 'master', 'emission'))
      .toEqual({ type: 'vec3', value: [0, 1, 0] })
  })
})

test.describe('with motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('edges stay anchored to their port dots after nodes appear', async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    const color = graphNode(page, 'Color')
    await waitForSettledLayout(page, color)

    const [start, end] = await edgeEndpoints(page.locator('.react-flow__edge-path'))
    const source = await handleAnchor(port(color, 'out'), 'output')
    const target = await handleAnchor(port(graphNode(page, 'Master Stack'), 'baseColor'), 'input')

    for (const [actual, expected] of [
      [start, source],
      [end, target],
    ] as const) {
      expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX)
      expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX)
    }
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
