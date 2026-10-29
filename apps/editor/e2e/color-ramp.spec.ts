import { expect, test, type Locator, type Page } from '@playwright/test'

import { firstSettledCompileCount, settledCompileCount } from './support/pending-work'
import { readStoredEdgeCount, readStoredNodes } from './support/read-autosave'
import { AUTOSAVE_KEY, graphDocument, seedAutosave } from './support/seed-graph'

/** Enough Tab presses to cross a node's header, settings and stop rows. */
const MAX_TABS = 40

/** A node on the canvas (the Properties panel has groups named after properties too). */
function graphNode(page: Page, name: string): Locator {
  return page.getByRole('main', { name: 'Node canvas' }).getByRole('group', { name, exact: true })
}

async function storedRamp(page: Page, nodeId: string) {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  return { params: node?.params ?? {}, inputValues: node?.inputValues ?? {} }
}

async function storedCount(page: Page, nodeId: string): Promise<unknown> {
  return (await storedRamp(page, nodeId)).params.count
}

async function storedValue(page: Page, nodeId: string, inputId: string): Promise<unknown> {
  return (await storedRamp(page, nodeId)).inputValues[inputId]
}

/** The input port an edge of the autosave document feeds, or null when the edge is gone. */
async function storedEdgeTarget(page: Page, edgeId: string): Promise<unknown> {
  return page.evaluate(
    ({ key, id }) => {
      const document: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (typeof document !== 'object' || document === null || !('edges' in document)) return null
      const edges: unknown = document.edges
      if (typeof edges !== 'object' || edges === null || !(id in edges)) return null
      const edge: unknown = Reflect.get(edges, id)
      if (typeof edge !== 'object' || edge === null || !('to' in edge)) return null
      return edge.to
    },
    { key: AUTOSAVE_KEY, id: edgeId },
  )
}

async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let press = 0; press < MAX_TABS; press += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

/** A three-stop ramp feeding Base Color, its middle color wired from a Color node. */
const WIRED_RAMP = graphDocument(
  [
    {
      id: 'ramp',
      type: 'color/color-ramp',
      position: { x: 200, y: 0 },
      params: { count: 3 },
      inputValues: {
        stop1Position: { type: 'float', value: 0.25 },
        stop1Color: { type: 'vec3', value: [1, 0, 0] },
        stop2Position: { type: 'float', value: 1 },
      },
    },
    {
      id: 'tint',
      type: 'input/color',
      position: { x: -100, y: 0 },
      inputValues: { color: { type: 'vec3', value: [0, 0.5, 1] } },
    },
  ],
  [
    { id: 'ramp-to-base', from: ['ramp', 'out'], to: ['master', 'baseColor'] },
    { id: 'tint-to-middle', from: ['tint', 'out'], to: ['ramp', 'stop1Color'] },
  ],
)

test('a color ramp added from the menu takes a third stop from the keyboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('main', { name: 'Node canvas' }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.type('color ramp')
  await page.keyboard.press('Enter')

  const ramp = graphNode(page, 'Color Ramp')
  await expect(ramp).toBeFocused()
  const rampId = String(await ramp.getAttribute('data-id'))
  const addStop = ramp.getByRole('button', { name: 'Add stop' })

  await tabUntilFocused(page, addStop)
  await page.keyboard.press('Enter')

  await expect.poll(async () => storedCount(page, rampId)).toBe(3)
  await expect(ramp.getByRole('slider', { name: 'Stop 3 position' })).toBeVisible()
  await expect(addStop).toBeFocused()
})

test('arrow keys move a stop by 0.01 without recompiling, and it stops at its neighbour', async ({
  page,
}) => {
  await seedAutosave(page, WIRED_RAMP)
  await page.goto('/')
  const compilesBefore = await firstSettledCompileCount(page)
  const position = graphNode(page, 'Color Ramp').getByRole('slider', { name: 'Stop 2 position' })

  await position.focus()
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(async () => storedValue(page, 'ramp', 'stop1Position'))
    .toEqual({ type: 'float', value: 0.26 })

  await page.keyboard.press('Shift+ArrowRight')
  await expect(position).toHaveAttribute('aria-valuenow', '0.36')

  // End goes to the next stop, and no further.
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowRight')
  await expect(position).toHaveAttribute('aria-valuenow', '1')
  await expect
    .poll(async () => storedValue(page, 'ramp', 'stop1Position'))
    .toEqual({ type: 'float', value: 1 })

  expect(await settledCompileCount(page)).toBe(compilesBefore)

  // Escape leaves the slider for the node, like any field in a node.
  await page.keyboard.press('Escape')
  await expect(graphNode(page, 'Color Ramp')).toBeFocused()
})

test('removing a wired stop drops its edge, and one undo brings both back', async ({ page }) => {
  await seedAutosave(page, WIRED_RAMP)
  await page.goto('/')
  const ramp = graphNode(page, 'Color Ramp')
  await expect.poll(async () => readStoredEdgeCount(page)).toBe(2)

  await ramp.getByRole('button', { name: 'Remove stop 2' }).focus()
  await page.keyboard.press('Enter')

  await expect.poll(async () => storedCount(page, 'ramp')).toBe(2)
  await expect.poll(async () => readStoredEdgeCount(page)).toBe(1)
  await expect(ramp.locator('[data-port-id="stop2Color"]')).toHaveCount(0)
  // The last stop took the removed one's place; with two left, Remove is off, so focus is on
  // that row's position.
  await expect(ramp.getByRole('slider', { name: 'Stop 2 position' })).toBeFocused()

  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => storedCount(page, 'ramp')).toBe(3)
  await expect.poll(async () => readStoredEdgeCount(page)).toBe(2)
  await expect(ramp.getByText('Wired')).toBeVisible()
})

test('Delete on a stop position removes the stop, down to two stops', async ({ page }) => {
  await seedAutosave(page, WIRED_RAMP)
  await page.goto('/')
  const ramp = graphNode(page, 'Color Ramp')

  await ramp.getByRole('slider', { name: 'Stop 1 position' }).focus()
  await page.keyboard.press('Delete')
  await expect.poll(async () => storedCount(page, 'ramp')).toBe(2)

  // Two stops is the fewest: Delete leaves them, and the node stays on the canvas.
  await expect(ramp.getByRole('slider', { name: 'Stop 1 position' })).toBeFocused()
  await page.keyboard.press('Delete')
  await expect(ramp.getByRole('slider', { name: 'Stop 2 position' })).toBeVisible()
  expect(await storedCount(page, 'ramp')).toBe(2)
})

test('move up trades colors with the stop above, wires included, keeping the positions', async ({
  page,
}) => {
  await seedAutosave(page, WIRED_RAMP)
  await page.goto('/')
  const ramp = graphNode(page, 'Color Ramp')

  await ramp.getByRole('button', { name: 'Move stop 2 down' }).focus()
  await page.keyboard.press('Enter')

  // The wired color moved down with its wire; the white of stop 3 took its place.
  await expect
    .poll(async () => storedEdgeTarget(page, 'tint-to-middle'))
    .toEqual({ nodeId: 'ramp', portId: 'stop2Color' })
  await expect
    .poll(async () => storedValue(page, 'ramp', 'stop1Color'))
    .toEqual({ type: 'vec3', value: [1, 1, 1] })
  expect(await storedValue(page, 'ramp', 'stop1Position')).toEqual({ type: 'float', value: 0.25 })
  await expect(ramp.getByRole('button', { name: 'Stop 2 color' })).toBeVisible()
  await expect(ramp.locator('[data-stop-index="2"]')).toContainText('Wired')
  // Focus follows the moved color to the row below, where Move down is off.
  await expect(ramp.getByRole('button', { name: 'Move stop 3 up' })).toBeFocused()

  // One undo puts the color and its wire back.
  await page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(async () => storedEdgeTarget(page, 'tint-to-middle'))
    .toEqual({ nodeId: 'ramp', portId: 'stop1Color' })
})

test('the marker of a wired position cannot be dragged', async ({ page }) => {
  await seedAutosave(
    page,
    graphDocument(
      [
        {
          id: 'ramp',
          type: 'color/color-ramp',
          position: { x: 200, y: 0 },
          params: { count: 3 },
          inputValues: { stop1Position: { type: 'float', value: 0.5 } },
        },
        { id: 'wave', type: 'math/sin', position: { x: -100, y: 0 } },
      ],
      [{ id: 'wave-to-middle', from: ['wave', 'out'], to: ['ramp', 'stop1Position'] }],
    ),
  )
  await page.goto('/')
  const marker = graphNode(page, 'Color Ramp').locator('[data-wired]')
  await expect(marker).toHaveCount(1)
  const box = await marker.boundingBox()
  if (box === null) throw new Error('The wired marker has no bounding box')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 4 })
  await page.mouse.up()

  expect(await storedValue(page, 'ramp', 'stop1Position')).toEqual({ type: 'float', value: 0.5 })
})
