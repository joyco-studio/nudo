import { expect, test, type Locator, type Page } from '@playwright/test'

import { tabUntilFocused } from './support/focus-indicators'
import { COLOR_TO_BASE_COLOR, TIME_TO_SINE, seedAutosave } from './support/seed-graph'

const DRAG_STEPS = 8

function canvas(page: Page): Locator {
  return page.getByRole('main', { name: 'Node canvas' })
}

function codeRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Generated TSL' })
}

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

function portHandle(node: Locator, portId: string): Locator {
  return node.locator(`[data-port-id="${portId}"] .react-flow__handle`)
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

/** Opens the code drawer the way the shortcut catalog says: C, with focus on the canvas. */
async function openCodePanel(page: Page): Promise<void> {
  await canvas(page).focus()
  await page.keyboard.press('c')
  await expect(codeRegion(page)).toBeVisible()
}

/** The module as the panel holds it: its text, without the line numbers. */
async function displayedCode(page: Page): Promise<string> {
  return codeRegion(page)
    .locator('pre')
    .evaluate((element) => element.textContent)
}

test.describe('code panel', () => {
  test('code panel shows generated module and updates on connect', async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await openCodePanel(page)

    const region = codeRegion(page)
    await expect(region).toHaveAttribute('tabindex', '0')
    await expect(region).toContainText("from 'three/tsl'")
    await expect(region).toContainText('colorNode: color1')
    await expect(region).toContainText('emissiveNode: color(0x000000)')

    await dragWithMouse(
      page,
      portHandle(graphNode(page, 'Color'), 'out'),
      portHandle(graphNode(page, 'Master Stack'), 'emission'),
    )

    await expect(region).toContainText('emissiveNode: color1')
  })

  test('copy puts the module on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await openCodePanel(page)

    await page.getByRole('button', { name: 'Copy', exact: true }).click()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toBe(await displayedCode(page))
    expect(copied).toContain('export const nodes')
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Copied' })).toHaveCount(1)
  })

  test('generated code imports only used symbols', async ({ page }) => {
    // Time and Sine sit on the canvas, joined to each other but to nothing the material reads.
    await seedAutosave(page, TIME_TO_SINE)
    await page.goto('/')
    await openCodePanel(page)

    const region = codeRegion(page)
    await expect(region).toContainText("import { color, float } from 'three/tsl'")
    expect(await displayedCode(page)).not.toMatch(/\b(?:time|sin)\b/)

    await dragWithMouse(
      page,
      portHandle(graphNode(page, 'Sine'), 'out'),
      portHandle(graphNode(page, 'Master Stack'), 'roughness'),
    )

    await expect(region).toContainText("import { color, float, sin, time } from 'three/tsl'")
    await expect(region).toContainText('roughnessNode: sine1')
  })

  test('copy and the code region work from the keyboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await openCodePanel(page)

    // Copy sits just before the panel's own toggle in the header.
    await page.getByRole('button', { name: 'Code panel', exact: true }).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeFocused()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await displayedCode(page))

    // The code region scrolls, so it is a tab stop with the quiet inset indicator.
    const region = codeRegion(page)
    await tabUntilFocused(page, region)
    await expect(region).toHaveCSS('box-shadow', /inset/)
    const scrollBefore = await region.evaluate((element) => element.scrollTop)
    await page.keyboard.press('PageDown')
    await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(scrollBefore)
  })
})
