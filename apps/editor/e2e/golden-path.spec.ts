import { expect, test, type Locator, type Page } from '@playwright/test'

import { tabUntilFocused } from './support/focus-indicators'
import { readStoredEdgeCount } from './support/read-autosave'

const EXPECTED_EDGE_COUNT = 6
const EXPECTED_NODE_COUNT = 7
const EXPECTED_EDGE_NAMES = [
  'Time Out to Sine In',
  'Sine Out to Lerp T',
  'Color Out to Lerp A',
  'Color Out to Lerp B',
  'Lerp Out to Master Stack Base Color',
  'Fresnel Out to Master Stack Emission',
] as const

function graphNode(page: Page, name: string, index = 0): Locator {
  return page.getByRole('group', { name, exact: true }).nth(index)
}

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

/** Opens the add-node menu from the header button, searches and adds the first match. */
async function addNode(page: Page, search: string, expectedTitle: string): Promise<void> {
  await page.getByRole('button', { name: 'Add node', exact: true }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Add node' })
  await expect(dialog).toBeVisible()
  await page.keyboard.type(search)
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('group', { name: expectedTitle, exact: true }).last()).toBeFocused()
}

/** Connects `fromPort` to the one port `query` narrows the list to, using only Tab, Enter and typing. */
async function connectByKeyboard(
  page: Page,
  fromNode: Locator,
  fromPort: RegExp,
  listName: string,
  query: string,
): Promise<void> {
  await fromNode.focus()
  await tabUntilFocused(page, fromNode.getByRole('button', { name: fromPort }))
  await page.keyboard.press('Enter')
  const list = page.getByRole('dialog', { name: listName })
  await expect(list).toBeVisible()
  await page.keyboard.type(query)
  await expect(list.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(list).toBeHidden()
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
