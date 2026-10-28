import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  addNodeFromHeader as addNode,
  connectByKeyboard,
  graphNode,
} from './support/graph-keyboard'
import { readStoredEdgeCount } from './support/read-autosave'

const EXPECTED_EDGE_COUNT = 6
const EXPECTED_NODE_COUNT = 7
const EXPECTED_EDGE_NAMES = [
  'Time Out to Sine In',
  'Sine Out to Lerp T',
  'Color Out to Lerp A',
  'Color Out to Lerp B',
  'Lerp Out to Master Stack Base Color',
  // A float feeding a vec3 input: the edge's name also says how the value is converted.
  'Fresnel Out to Master Stack Emission. ' +
    'Converted from float to vec3: the value is copied into x, y and z.',
] as const

function edges(page: Page): Locator {
  return page.locator('.react-flow__edge-path')
}

function errorBorders(page: Page): Locator {
  return page.locator('[data-error="true"]')
}

async function expectGoldenPathGraph(page: Page): Promise<void> {
  await expect(page.locator('.react-flow__node')).toHaveCount(EXPECTED_NODE_COUNT)
  await expect(edges(page)).toHaveCount(EXPECTED_EDGE_COUNT)
  for (const name of EXPECTED_EDGE_NAMES) {
    await expect(page.getByRole('group', { name, exact: true })).toBeAttached()
  }
  await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
  await expect(errorBorders(page)).toHaveCount(0)
}

async function compileCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoCompileCount ?? 0)
}

test('golden path: Time → Sin → Lerp(t) between two Colors → Base Color, plus Fresnel → Emission, compiles without node errors and survives reload', async ({
  page,
}) => {
  await page.goto('/')
  await expect(graphNode(page, 'Master Stack')).toBeVisible()
  await expect(edges(page)).toHaveCount(0)

  await addNode(page, 'time', 'Time')
  await addNode(page, 'sine', 'Sine')
  await addNode(page, 'lerp', 'Lerp')
  await addNode(page, 'color', 'Color')
  await addNode(page, 'color', 'Color')
  await addNode(page, 'fresnel', 'Fresnel')
  await expect(page.locator('.react-flow__node')).toHaveCount(EXPECTED_NODE_COUNT)

  await connectByKeyboard(
    page,
    graphNode(page, 'Time'),
    /^Out, output port/,
    'Connect Time › Out',
    'sine ›',
  )
  await connectByKeyboard(
    page,
    graphNode(page, 'Sine'),
    /^Out, output port/,
    'Connect Sine › Out',
    'lerp › t',
  )
  await connectByKeyboard(
    page,
    graphNode(page, 'Color', 0),
    /^Out, output port/,
    'Connect Color › Out',
    'lerp › a',
  )
  await connectByKeyboard(
    page,
    graphNode(page, 'Color', 1),
    /^Out, output port/,
    'Connect Color › Out',
    'lerp › b',
  )
  await connectByKeyboard(
    page,
    graphNode(page, 'Lerp'),
    /^Out, output port/,
    'Connect Lerp › Out',
    'base color',
  )
  await connectByKeyboard(
    page,
    graphNode(page, 'Fresnel'),
    /^Out, output port/,
    'Connect Fresnel › Out',
    'emission',
  )

  await expectGoldenPathGraph(page)
  await expect.poll(() => readStoredEdgeCount(page)).toBe(EXPECTED_EDGE_COUNT)

  await page.reload()

  await expectGoldenPathGraph(page)
})
