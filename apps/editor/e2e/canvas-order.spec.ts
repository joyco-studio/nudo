import { expect, test, type Locator, type Page } from '@playwright/test'

import { countReddishPixels } from './support/count-reddish-pixels'
import { readStoredEdgeCount, readStoredNodes } from './support/read-autosave'
import { COLOR_TO_BASE_COLOR, seedAutosave } from './support/seed-graph'
import { TUTORIAL_EDGES, TUTORIAL_GRAPH, TUTORIAL_NODE_COUNT } from './support/tutorial-graph'

interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const MIN_REDDISH_PIXELS = 200
/** Longer than the compile debounce (150 ms), so a pending rebuild would have fired by then. */
const PAST_DEBOUNCE_MS = 500

function canvas(page: Page): Locator {
  return page.getByRole('main', { name: 'Node canvas' })
}

function flowNode(page: Page, id: string): Locator {
  return page.locator(`.react-flow__node[data-id="${id}"]`)
}

function panel(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true })
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Element has no bounding box')
  return box
}

/** Every graph node's box (comment frames sit behind nodes on purpose and are left out). */
async function nodeBoxes(page: Page): Promise<ReadonlyMap<string, Box>> {
  const nodes = page.locator('.react-flow__node:not(.react-flow__node-comment)')
  const ids = await nodes.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-id') ?? ''),
  )
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, Box]> => [id, await boxOf(flowNode(page, id))]),
  )
  return new Map(entries)
}

/** Resolves once every node is drawn and the view has stopped moving. */
async function waitForSettledView(page: Page, nodeCount: number): Promise<void> {
  await expect(page.locator('.react-flow__node')).toHaveCount(nodeCount)
  await expect(flowNode(page, 'master')).toBeVisible()
  let previous = await boxOf(flowNode(page, 'master'))
  await expect
    .poll(async () => {
      const current = await boxOf(flowNode(page, 'master'))
      const isStable = current.x === previous.x && current.y === previous.y
      previous = current
      return isStable
    })
    .toBe(true)
}

async function expectNodesClearOf(page: Page, panels: readonly Locator[]): Promise<void> {
  const boxes = await nodeBoxes(page)
  for (const panelLocator of panels) {
    const panelBox = await boxOf(panelLocator)
    for (const [id, box] of boxes) {
      expect(overlaps(box, panelBox), `${id} under a panel`).toBe(false)
    }
  }
}

async function storedPositions(page: Page): Promise<ReadonlyMap<string, unknown>> {
  return new Map((await readStoredNodes(page)).map((node) => [node.id, node.position]))
}

test.describe('panel-aware view', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, TUTORIAL_GRAPH)
    await page.goto('/')
    await waitForSettledView(page, TUTORIAL_NODE_COUNT)
  })

  test('fits the graph between the Properties panel and the Inspector, on load and with F', async ({
    page,
  }) => {
    const panels = [
      panel(page, 'Properties'),
      panel(page, 'Inspector'),
      panel(page, 'Main preview'),
    ]
    await expectNodesClearOf(page, panels)

    // Pan the graph under the Properties panel, then fit it back out.
    await canvas(page).focus()
    for (let step = 0; step < 6; step += 1) await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('f')
    await waitForSettledView(page, TUTORIAL_NODE_COUNT)
    await expectNodesClearOf(page, panels)
  })

  test('still fits clear of the panels after the Properties panel collapses', async ({ page }) => {
    await page.getByRole('button', { name: 'Properties panel' }).click()
    await canvas(page).focus()
    await page.keyboard.press('f')
    await waitForSettledView(page, TUTORIAL_NODE_COUNT)

    const collapsedHeader = panel(page, 'Properties')
    await expectNodesClearOf(page, [collapsedHeader, panel(page, 'Inspector')])
    // Collapsed, it no longer costs the canvas its left edge: the graph uses that room.
    const leftmost = Math.min(...[...(await nodeBoxes(page)).values()].map((box) => box.x))
    expect(leftmost).toBeLessThan((await boxOf(collapsedHeader)).x + 240)
  })
})

test.describe('tidy up', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, TUTORIAL_GRAPH)
    await page.goto('/')
    await waitForSettledView(page, TUTORIAL_NODE_COUNT)
  })

  test('Shift+T lays the graph out left to right as one undo step, with no overlaps', async ({
    page,
  }) => {
    await canvas(page).focus()
    // Any small move gets the graph into the autosave, so there is a "before" to compare with.
    await page.keyboard.press('Shift+T')
    await expect.poll(async () => (await readStoredNodes(page)).length).toBe(TUTORIAL_NODE_COUNT)
    await waitForSettledView(page, TUTORIAL_NODE_COUNT)

    const boxes = await nodeBoxes(page)
    const entries = [...boxes.entries()]
    for (const [index, [id, box]] of entries.entries()) {
      for (const [otherId, other] of entries.slice(index + 1)) {
        expect(overlaps(box, other), `${id} overlaps ${otherId}`).toBe(false)
      }
    }
    for (const edge of TUTORIAL_EDGES) {
      const source = boxes.get(edge.from[0])
      const target = boxes.get(edge.to[0])
      if (source === undefined || target === undefined) throw new Error(`Missing ${edge.id}`)
      expect(source.x + source.width, edge.id).toBeLessThan(target.x)
    }
    const master = boxes.get('master')
    for (const [id, box] of boxes) {
      if (id !== 'master') expect(box.x, id).toBeLessThan(master?.x ?? 0)
    }

    const tidied = await storedPositions(page)
    await page.keyboard.press('ControlOrMeta+z')
    await expect
      .poll(async () => (await storedPositions(page)).get('pos'))
      .toEqual({ x: 40, y: 120 })
    const restored = await storedPositions(page)
    expect(restored.get('lerp2')).toEqual({ x: 1540, y: 1150 })
    expect(restored.get('master')).toEqual({ x: 1715, y: 520 })
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect.poll(() => storedPositions(page)).toEqual(tidied)
  })

  test('the canvas menu tidies up too, and the selection menu only the selected nodes', async ({
    page,
  }) => {
    const before = await boxOf(flowNode(page, 'normal'))
    // The two color pills, which feed the same Lerp: after tidying, one sits under the other.
    // Shift + drag a selection box around both, from the empty canvas left of them.
    const deep = await boxOf(flowNode(page, 'deep'))
    const hot = await boxOf(flowNode(page, 'hot'))
    await page.keyboard.down('Shift')
    await page.mouse.move(deep.x - 6, deep.y - 4)
    await page.mouse.down()
    await page.mouse.move(hot.x + hot.width + 6, hot.y + hot.height + 4, { steps: 8 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
    // The seeded pills sit under their neighbors' edges; the keyboard opens the node's menu.
    await flowNode(page, 'deep').focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Tidy up selection' }).click()

    await expect
      .poll(async () => (await storedPositions(page)).get('hot'))
      .not.toEqual({
        x: 1020,
        y: 920,
      })
    expect(await boxOf(flowNode(page, 'normal'))).toEqual(before)

    await canvas(page).focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Tidy up graph' }).click()
    await expect
      .poll(async () => (await storedPositions(page)).get('normal'))
      .not.toEqual({
        x: 770,
        y: 560,
      })
  })
})

test.describe('reroute', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await waitForSettledView(page, 2)
  })

  test('a double click on a connection inserts a reroute, and the preview stays the same', async ({
    page,
  }) => {
    const previewCanvas = panel(page, 'Main preview').locator('canvas')
    await expect
      .poll(async () => countReddishPixels(page, await previewCanvas.screenshot()))
      .toBeGreaterThan(MIN_REDDISH_PIXELS)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    const reddishBefore = await countReddishPixels(page, await previewCanvas.screenshot())
    const compilesBefore = await page.evaluate(() => window.__nudoCompileCount ?? 0)

    const edge = page.locator('.react-flow__edge').first()
    const path = await boxOf(edge.locator('.react-flow__edge-path'))
    await page.mouse.dblclick(path.x + path.width / 2, path.y + path.height / 2)

    const reroute = page.locator('.react-flow__node-reroute')
    await expect(reroute).toHaveCount(1)
    await expect(reroute).toHaveAccessibleName('Reroute')
    await expect(page.locator('.react-flow__edge')).toHaveCount(2)
    await expect.poll(() => readStoredEdgeCount(page)).toBe(2)
    await expect(
      reroute.getByRole('button', { name: 'In, input port, vec3, connected' }),
    ).toBeAttached()

    await expect
      .poll(() => page.evaluate(() => window.__nudoCompileCount ?? 0))
      .toBeGreaterThan(compilesBefore)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    await expect(page.locator('.react-flow__node [data-error="true"]')).toHaveCount(0)
    expect(await countReddishPixels(page, await previewCanvas.screenshot())).toBe(reddishBefore)
  })

  test('the connection menu inserts a reroute from the keyboard and focuses it', async ({
    page,
  }) => {
    const edge = page.locator('.react-flow__edge').first()
    await edge.focus()
    await page.keyboard.press('Shift+F10')
    await expect(page.getByRole('menuitem', { name: 'Insert reroute' })).toBeVisible()
    await page.keyboard.press('Enter')

    const reroute = page.locator('.react-flow__node-reroute')
    await expect(reroute).toBeFocused()
    await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  })

  test('the add-node menu adds a reroute', async ({ page }) => {
    await canvas(page).focus()
    await page.keyboard.press('Space')
    await page.keyboard.type('reroute')
    await page.keyboard.press('Enter')
    await expect(page.locator('.react-flow__node-reroute')).toBeFocused()
  })
})

test.describe('chain highlight', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, TUTORIAL_GRAPH)
    await page.goto('/')
    await waitForSettledView(page, TUTORIAL_NODE_COUNT)
  })

  test('selecting a node dims unrelated connections and nodes, and keeps its chain', async ({
    page,
  }) => {
    await flowNode(page, 'fresnel').click()

    const chainEdge = page.locator('.react-flow__edge[data-id="fresnel.out-mul4.a"]')
    const downstream = page.locator('.react-flow__edge[data-id="mul4.out-master.emission"]')
    const unrelated = page.locator('.react-flow__edge[data-id="time.out-mul1.a"]')
    await expect(chainEdge).toHaveClass(/chain-emphasized/)
    await expect(downstream).toHaveClass(/chain-emphasized/)
    await expect(unrelated).toHaveClass(/chain-dimmed/)
    await expect(unrelated).toHaveCSS('opacity', '0.2')
    await expect(flowNode(page, 'time')).toHaveClass(/chain-dimmed/)
    await expect(flowNode(page, 'mul4')).not.toHaveClass(/chain-dimmed/)
    await expect(flowNode(page, 'master')).not.toHaveClass(/chain-dimmed/)

    // Clearing the selection brings everything back.
    await page.keyboard.press('Escape')
    const empty = await boxOf(canvas(page))
    await page.mouse.click(empty.x + empty.width / 2, empty.y + 60)
    await expect(page.locator('.react-flow__edge.chain-dimmed')).toHaveCount(0)
  })
})
