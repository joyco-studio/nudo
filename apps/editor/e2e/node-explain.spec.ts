import { expect, test, type Locator, type Page } from '@playwright/test'

import { tabUntilFocused } from './support/focus-indicators'
import { graphDocument, seedAutosave } from './support/seed-graph'

/** Time feeds Multiply's A; Multiply's float result feeds the master's Emission (float → vec3). */
const TIME_TIMES_B_TO_EMISSION = graphDocument(
  [
    { id: 'time', type: 'input/time', position: { x: -100, y: 100 } },
    { id: 'multiply', type: 'math/multiply', position: { x: 250, y: 100 } },
  ],
  [
    { id: 'time-to-a', from: ['time', 'out'], to: ['multiply', 'a'] },
    { id: 'multiply-to-emission', from: ['multiply', 'out'], to: ['master', 'emission'] },
  ],
)

/** Nothing is wired: every Multiply input shows its inline field, which has a label of its own. */
const UNCONNECTED_MULTIPLY = graphDocument(
  [{ id: 'multiply', type: 'math/multiply', position: { x: 250, y: 100 } }],
  [],
)

const A_DESCRIPTION = 'The value to scale.'
const B_DESCRIPTION = 'How much to scale A by: 0 zeroes it, 1 keeps it, 2 doubles it.'
const SPLAT_DESCRIPTION = 'Converted from float to vec3: the value is copied into x, y and z.'

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

function portButton(node: Locator, name: RegExp): Locator {
  return node.getByRole('button', { name })
}

function visibleTooltip(page: Page): Locator {
  return page.locator('[data-slot="tooltip-content"]')
}

async function openCanvas(page: Page): Promise<void> {
  await seedAutosave(page, TIME_TIMES_B_TO_EMISSION)
  await page.goto('/')
  await expect(graphNode(page, 'Multiply')).toBeVisible()
}

test.describe('node explanations', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('the node header shows the formula, hidden while the node is collapsed', async ({
    page,
  }) => {
    const multiply = graphNode(page, 'Multiply')
    const formula = multiply.locator('header').getByText('A × B', { exact: true })
    await expect(formula).toBeVisible()

    await multiply.getByRole('button', { name: 'Unconnected ports' }).click()
    await expect(formula).toBeHidden()
  })

  test("hovering Multiply's A shows its label, type, description and source", async ({ page }) => {
    await portButton(graphNode(page, 'Multiply'), /^A, input port/).hover()

    const tooltip = visibleTooltip(page)
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.font-medium')).toHaveText('A')
    await expect(tooltip.locator('[data-type-chip]')).toHaveText('float')
    await expect(tooltip).toContainText(A_DESCRIPTION)
    await expect(tooltip).toContainText('from Time · Out')
  })

  test('keyboard focus on a port shows its tooltip at once', async ({ page }) => {
    const portB = portButton(graphNode(page, 'Multiply'), /^B, input port/)
    await tabUntilFocused(page, portB)

    await expect(visibleTooltip(page)).toContainText(B_DESCRIPTION)
    await expect(portB).toHaveAccessibleDescription(B_DESCRIPTION)

    await page.keyboard.press('Escape')
    await expect(visibleTooltip(page)).toHaveCount(0)
    await expect(portB).toBeFocused()
  })

  test('the Inspector shows the formula and every input description', async ({ page }) => {
    await graphNode(page, 'Multiply').locator('header').click()

    const inspector = page.getByRole('region', { name: 'Inspector' })
    await expect(inspector.getByRole('heading', { name: 'Multiply' })).toBeVisible()
    await expect(inspector).toContainText('A × B')
    await expect(inspector).toContainText(A_DESCRIPTION)
    await expect(inspector).toContainText(B_DESCRIPTION)
  })

  test('the conversion badge explains itself on hover and to the keyboard', async ({ page }) => {
    const badge = page.getByRole('img', { name: SPLAT_DESCRIPTION })
    await expect(badge).toHaveText('1→3')

    await badge.hover()
    await expect(visibleTooltip(page)).toHaveText(SPLAT_DESCRIPTION)
    await page.mouse.move(0, 0)
    await expect(visibleTooltip(page)).toHaveCount(0)

    const edge = page.getByRole('group', { name: /^Multiply Out to Master Stack Emission/ })
    await expect(edge).toHaveAccessibleName(
      `Multiply Out to Master Stack Emission. ${SPLAT_DESCRIPTION}`,
    )
    await tabUntilFocused(page, edge)
    await expect(visibleTooltip(page)).toHaveText(SPLAT_DESCRIPTION)

    // React Flow blurs a focused edge on Escape, which also closes its explanation.
    await page.keyboard.press('Escape')
    await expect(visibleTooltip(page)).toHaveCount(0)
  })
})

test.describe('labels of unconnected inputs', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, UNCONNECTED_MULTIPLY)
    await page.goto('/')
    await expect(graphNode(page, 'Multiply')).toBeVisible()
  })

  test('hovering the label A next to its number field shows what A is', async ({ page }) => {
    const multiply = graphNode(page, 'Multiply')
    await expect(multiply.getByRole('textbox', { name: 'A' })).toBeVisible()
    await multiply.locator('label', { hasText: /^A$/ }).hover()

    const tooltip = visibleTooltip(page)
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.font-medium')).toHaveText('A')
    await expect(tooltip.locator('[data-type-chip]')).toHaveText('float')
    await expect(tooltip).toContainText(A_DESCRIPTION)
    await expect(tooltip).toContainText('Drag to change')
    await expect(tooltip).not.toContainText('from ')
  })

  test('hovering the label of a color input explains it too', async ({ page }) => {
    const master = graphNode(page, 'Master Stack')
    await master.getByText('Emission', { exact: true }).hover()

    const tooltip = visibleTooltip(page)
    await expect(tooltip.locator('.font-medium')).toHaveText('Emission')
    await expect(tooltip.locator('[data-type-chip]')).toHaveText('vec3')
    await expect(tooltip).toContainText('Light the surface gives off on its own')
  })

  test('the description stays reachable from the keyboard on the same row', async ({ page }) => {
    const portA = portButton(graphNode(page, 'Multiply'), /^A, input port/)
    await tabUntilFocused(page, portA)

    await expect(visibleTooltip(page)).toContainText(A_DESCRIPTION)
    await expect(portA).toHaveAccessibleDescription(A_DESCRIPTION)
  })
})

test.describe('tooltip state', () => {
  test('dragging an edge and focusing one never switches a tooltip between uncontrolled and controlled', async ({
    page,
  }) => {
    const switchWarnings: string[] = []
    page.on('console', (message) => {
      if (/uncontrolled to controlled|controlled to uncontrolled/i.test(message.text())) {
        switchWarnings.push(message.text())
      }
    })
    await openCanvas(page)

    const timeOut = portButton(graphNode(page, 'Time'), /^Out, output port/)
    const box = await timeOut.boundingBox()
    if (box === null) throw new Error('The Time output port has no box')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y - 160, { steps: 8 })
    await expect(visibleTooltip(page)).toHaveCount(0)
    await page.mouse.up()

    const edge = page.getByRole('group', { name: /^Multiply Out to Master Stack Emission/ })
    await tabUntilFocused(page, edge)
    await expect(visibleTooltip(page)).toHaveText(SPLAT_DESCRIPTION)
    await page.keyboard.press('Escape')
    await expect(visibleTooltip(page)).toHaveCount(0)

    expect(switchWarnings).toEqual([])
  })

  test('a port tooltip hovered during an edge drag does not come back after it', async ({
    page,
  }) => {
    await openCanvas(page)
    const timeOut = portButton(graphNode(page, 'Time'), /^Out, output port/)
    const portB = portButton(graphNode(page, 'Multiply'), /^B, input port/)
    const timeBox = await timeOut.boundingBox()
    const bBox = await portB.boundingBox()
    if (timeBox === null || bBox === null) throw new Error('A port has no box')

    await page.mouse.move(timeBox.x + timeBox.width / 2, timeBox.y + timeBox.height / 2)
    await page.mouse.down()
    // Over B while the edge is dragged: its tooltip must stay shut, then stay forgotten.
    await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2, { steps: 8 })
    await expect(visibleTooltip(page)).toHaveCount(0)
    await page.mouse.up()
    await page.mouse.move(0, 0)
    await expect(visibleTooltip(page)).toHaveCount(0)
  })
})
