import { expect, test, type Locator, type Page } from '@playwright/test'

import { tabUntilFocused } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import { TIME_AND_SINE, graphDocument, seedAutosave } from './support/seed-graph'

const COMMENT_WIDTH = 400
const COMMENT_HEIGHT = 260

const COMMENT_FRAME = graphDocument(
  [
    {
      id: 'note',
      type: 'utility/comment',
      position: { x: -200, y: -200 },
      params: { title: 'Water', width: 320, height: 200 },
    },
  ],
  [],
)

function inspector(page: Page): Locator {
  return page.getByRole('region', { name: 'Inspector' })
}

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

async function storedNode(page: Page, nodeId: string) {
  return (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
}

test.describe('inspector', () => {
  test('inspector shows selected node and edits its value', async ({ page }) => {
    await seedAutosave(page, TIME_AND_SINE)
    await page.goto('/')
    const sine = graphNode(page, 'Sine')
    await sine.locator('header').click()

    const panel = inspector(page)
    await expect(panel.getByRole('heading', { name: 'Sine' })).toBeVisible()
    await expect(panel).toContainText('math/sin')
    await expect(panel).toContainText('Sine of the input')

    const field = panel.getByRole('textbox', { name: 'In', exact: true })
    await field.fill('0.75')
    await field.press('Enter')

    // One store: the node on the canvas shows the value the Inspector committed.
    await expect(sine.getByRole('textbox', { name: 'In', exact: true })).toHaveValue('0.75')
    await expect
      .poll(async () => (await storedNode(page, 'sine'))?.inputValues.in)
      .toEqual({ type: 'float', value: 0.75 })

    // The commit is one undo step.
    await sine.focus()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(field).toHaveValue('0')
  })

  test('graph settings switch lighting to unlit', async ({ page }) => {
    await page.goto('/')
    const panel = inspector(page)
    await expect(panel.getByRole('heading', { name: 'Graph settings' })).toBeVisible()
    await expect(panel).toContainText('Schema version')

    const lighting = panel.getByRole('combobox', { name: 'Lighting' })
    await lighting.focus()
    await page.keyboard.press('u')
    await expect(lighting).toHaveText('Unlit')

    // The master node edits the same setting.
    const master = graphNode(page, 'Master Stack')
    await expect(master.getByRole('combobox', { name: 'Lighting' })).toHaveText('Unlit')
    await expect.poll(async () => (await storedNode(page, 'master'))?.params.lighting).toBe('unlit')
  })

  test('physical lighting: the transmission switch turns its inputs on, keyboard only', async ({
    page,
  }) => {
    await page.goto('/')
    const panel = inspector(page)
    const master = graphNode(page, 'Master Stack')
    // The switches show only under physical lighting.
    await expect(panel.getByRole('switch', { name: 'Enable transmission' })).toHaveCount(0)

    const lighting = panel.getByRole('combobox', { name: 'Lighting' })
    await lighting.focus()
    await page.keyboard.press('p')
    await expect(lighting).toHaveText('Physical')

    // Physical lighting opens the Physical group; transmission waits for its switch.
    await expect(master.getByRole('button', { name: 'Physical', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const transmissionRow = master.locator('li[data-port-id="transmission"]')
    await expect(transmissionRow).toHaveAttribute('data-disabled', 'true')
    await expect(transmissionRow).toContainText('Turn on transmission to use this')

    const transmission = panel.getByRole('switch', { name: 'Enable transmission' })
    await expect(transmission).toHaveAccessibleDescription(/renders the scene behind once more/)
    await tabUntilFocused(page, transmission)
    await page.keyboard.press('Space')
    await expect(transmission).toBeChecked()

    await expect(transmissionRow).not.toHaveAttribute('data-disabled')
    await expect(
      transmissionRow.getByRole('textbox', { name: 'Transmission', exact: true }),
    ).toBeVisible()
    await expect
      .poll(async () => (await storedNode(page, 'master'))?.params)
      .toMatchObject({ lighting: 'physical', useTransmission: true })
  })

  test('the Physical group opens from the keyboard on a standard master', async ({ page }) => {
    await page.goto('/')
    const master = graphNode(page, 'Master Stack')
    const toggle = master.getByRole('button', { name: 'Physical', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const clearcoatRow = master.locator('li[data-port-id="clearcoat"]')
    await expect(clearcoatRow).toHaveCount(0)

    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(clearcoatRow).toContainText('Only Physical lighting uses this')

    await page.keyboard.press('Space')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(clearcoatRow).toHaveCount(0)
  })

  test('comment size editable from inspector', async ({ page }) => {
    await seedAutosave(page, COMMENT_FRAME)
    await page.goto('/')
    const frame = page.locator('.react-flow__node[data-id="note"]')
    await frame.click({ position: { x: 100, y: 100 } })

    const panel = inspector(page)
    const width = panel.getByRole('textbox', { name: 'Width', exact: true })
    await width.fill(String(COMMENT_WIDTH))
    await width.press('Enter')
    const height = panel.getByRole('textbox', { name: 'Height', exact: true })
    await height.fill(String(COMMENT_HEIGHT))
    await height.press('Enter')
    const title = panel.getByRole('textbox', { name: 'Title', exact: true })
    await title.fill('Pond')
    await title.press('Enter')

    await expect(frame).toHaveCSS('width', `${String(COMMENT_WIDTH)}px`)
    await expect(frame).toHaveCSS('height', `${String(COMMENT_HEIGHT)}px`)
    await expect(frame.getByRole('textbox', { name: 'Comment title' })).toHaveValue('Pond')
    await expect
      .poll(async () => (await storedNode(page, 'note'))?.params)
      .toMatchObject({ title: 'Pond', width: COMMENT_WIDTH, height: COMMENT_HEIGHT })
  })

  test('comment resize from inspector is one undo step', async ({ page }) => {
    await seedAutosave(page, COMMENT_FRAME)
    await page.goto('/')
    const frame = page.locator('.react-flow__node[data-id="note"]')
    await frame.click({ position: { x: 100, y: 100 } })

    const width = inspector(page).getByRole('textbox', { name: 'Width', exact: true })
    await width.fill('400.6')
    await width.press('Enter')
    // Sizes are whole pixels.
    await expect(frame).toHaveCSS('width', '401px')
    await expect(width).toHaveValue('401')

    await frame.focus()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(frame).toHaveCSS('width', '320px')
    await expect(width).toHaveValue('320')
    await expect.poll(async () => (await storedNode(page, 'note'))?.params.width).toBe(320)
  })

  test('comment note editable from inspector', async ({ page }) => {
    await seedAutosave(page, COMMENT_FRAME)
    await page.goto('/')
    const frame = page.locator('.react-flow__node[data-id="note"]')
    await frame.click({ position: { x: 100, y: 100 } })

    const note = inspector(page).getByRole('textbox', { name: 'Note', exact: true })
    await note.fill('Rosettes go here')
    await note.press('Tab')

    await expect(frame.getByRole('textbox', { name: 'Comment text' })).toHaveValue(
      'Rosettes go here',
    )
    await expect
      .poll(async () => (await storedNode(page, 'note'))?.params.body)
      .toBe('Rosettes go here')
  })

  test('escape in graph settings returns focus to the canvas', async ({ page }) => {
    await page.goto('/')
    const lighting = inspector(page).getByRole('combobox', { name: 'Lighting' })
    await lighting.focus()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('main', { name: 'Node canvas' })).toBeFocused()
  })

  test('escape in a multi-selection summary returns focus to the canvas', async ({ page }) => {
    await seedAutosave(page, TIME_AND_SINE)
    await page.goto('/')
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press('ControlOrMeta+a')
    const remove = inspector(page).getByRole('button', { name: 'Delete selected nodes' })
    await remove.focus()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('main', { name: 'Node canvas' })).toBeFocused()
    await expect(graphNode(page, 'Sine')).toBeVisible()
  })

  test('inspector is reachable by keyboard and returns focus to canvas with Escape', async ({
    page,
  }) => {
    await seedAutosave(page, TIME_AND_SINE)
    await page.goto('/')
    const sine = graphNode(page, 'Sine')
    await sine.locator('header').click()
    await sine.focus()

    const field = inspector(page).getByRole('textbox', { name: 'In', exact: true })
    await tabUntilFocused(page, field)
    await page.keyboard.type('0.3')

    // Escape reverts what was typed and goes back to the selected node on the canvas.
    await page.keyboard.press('Escape')
    await expect(sine).toBeFocused()
    await expect(field).toHaveValue('0')
  })

  test('several selected nodes show a count and delete together', async ({ page }) => {
    await seedAutosave(page, TIME_AND_SINE)
    await page.goto('/')
    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press('ControlOrMeta+a')

    const panel = inspector(page)
    await expect(panel).toContainText('3 nodes selected')
    await panel.getByRole('button', { name: 'Delete selected nodes' }).click()

    await expect(graphNode(page, 'Sine')).toHaveCount(0)
    await expect(graphNode(page, 'Time')).toHaveCount(0)
    await expect(graphNode(page, 'Master Stack')).toBeVisible()
  })
})
