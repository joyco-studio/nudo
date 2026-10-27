import { expect, test, type Locator, type Page } from '@playwright/test'

import { tabUntilFocused } from './support/focus-indicators'
import { readStoredEdgeCount, readStoredNodes, readStoredProperties } from './support/read-autosave'
import { graphDocumentV2, seedAutosave } from './support/seed-graph'

/** Longer than the compile debounce (150 ms), so a pending rebuild would have fired by then. */
const PAST_DEBOUNCE_MS = 500
const SCRUB_DISTANCE_PX = 60
const SCRUB_STEPS = 6
/** A node dropped on the canvas lands with its top-left corner this close to the drop point. */
const DROP_TOLERANCE_PX = 2
const INVALID_REFERENCE_NAMES = ['2x', 'my var', 'class', 'speed'] as const

function propertiesPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Properties', exact: true })
}

function propertyRow(page: Page, label: string): Locator {
  return propertiesPanel(page).getByRole('group', { name: label, exact: true })
}

/** The row's handle: the button named after the property that adds it to the canvas. */
function propertyHandle(page: Page, label: string): Locator {
  return propertyRow(page, label).getByRole('button', { name: label, exact: true })
}

/** A node on the canvas (the Properties panel has groups named after properties too). */
function graphNode(page: Page, name: string): Locator {
  return page.getByRole('main', { name: 'Node canvas' }).getByRole('group', { name, exact: true })
}

function canvasNodes(page: Page): Locator {
  return page.locator('.react-flow__node')
}

async function compileCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoCompileCount ?? 0)
}

async function previewApplyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoPreviewApplyCount ?? 0)
}

/** Waits for the first compile and its debounce, so later counts only move for new reasons. */
async function waitForSettledCompile(page: Page): Promise<number> {
  await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
  await page.waitForTimeout(PAST_DEBOUNCE_MS)
  return compileCount(page)
}

async function storedProperty(page: Page, id: string) {
  return (await readStoredProperties(page)).find((property) => property.id === id) ?? null
}

/** Adds a property of the given kind from the panel's "+" menu, with the keyboard only. */
async function addPropertyByKeyboard(page: Page, kind: string): Promise<void> {
  const addButton = propertiesPanel(page).getByRole('button', { name: 'Add property' })
  await addButton.focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Add property' })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: kind, exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(menu).toBeHidden()
}

/** One float property `speed`, read by two nodes feeding the master's Roughness and Metalness. */
const USED_FLOAT_PROPERTY = graphDocumentV2(
  [
    {
      id: 'reader-a',
      type: 'property/float',
      position: { x: 200, y: 40 },
      params: { propertyId: 'speed' },
    },
    {
      id: 'reader-b',
      type: 'property/float',
      position: { x: 200, y: 160 },
      params: { propertyId: 'speed' },
    },
  ],
  [
    { id: 'a-to-roughness', from: ['reader-a', 'out'], to: ['master', 'roughness'] },
    { id: 'b-to-metalness', from: ['reader-b', 'out'], to: ['master', 'metalness'] },
  ],
  [
    {
      id: 'speed',
      label: 'speed',
      name: 'speed',
      exposed: true,
      type: 'float',
      value: { type: 'float', value: 0.5 },
    },
  ],
)

/** Two float properties and no nodes besides the master. */
const TWO_FLOAT_PROPERTIES = graphDocumentV2(
  [],
  [],
  [
    {
      id: 'speed',
      label: 'speed',
      name: 'speed',
      exposed: true,
      type: 'float',
      value: { type: 'float', value: 0.5 },
    },
    {
      id: 'scale',
      label: 'scale',
      name: 'scale',
      exposed: true,
      type: 'float',
      value: { type: 'float', value: 1 },
    },
  ],
)

test.describe('Properties panel', () => {
  test('create float property, rename to waveSpeed, add to canvas by keyboard, connect, edit value without compile', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(graphNode(page, 'Master Stack')).toBeVisible()
    await expect(propertiesPanel(page).getByText('No properties yet.')).toBeVisible()

    await addPropertyByKeyboard(page, 'Float')
    // A new property starts in rename mode, with its default name.
    const nameField = propertiesPanel(page).getByRole('textbox', { name: 'Property name' })
    await expect(nameField).toBeFocused()
    await expect(nameField).toHaveValue('float1')
    await page.keyboard.type('waveSpeed')
    await page.keyboard.press('Enter')

    const handle = propertyHandle(page, 'waveSpeed')
    await expect(handle).toBeFocused()
    // The reference followed the label while it was still the generated default.
    await expect.poll(async () => (await readStoredProperties(page))[0]?.name).toBe('waveSpeed')

    await page.keyboard.press('Enter')
    const pill = graphNode(page, 'waveSpeed')
    await expect(pill).toBeFocused()
    await expect(pill.locator('[data-type-chip]')).toHaveText('float')

    await tabUntilFocused(page, pill.getByRole('button', { name: /^Out, output port/ }))
    await page.keyboard.press('Enter')
    const list = page.getByRole('dialog', { name: 'Connect waveSpeed › Out' })
    await expect(list).toBeVisible()
    await page.keyboard.type('roughness')
    await expect(list.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(list).toBeHidden()
    await expect.poll(() => readStoredEdgeCount(page)).toBe(1)

    const compilesBefore = await waitForSettledCompile(page)
    const propertyId = String((await readStoredProperties(page))[0]?.id)
    const valueField = propertyRow(page, 'waveSpeed').getByRole('textbox', { name: 'Value' })
    await valueField.fill('2.5')
    await page.keyboard.press('Enter')
    await expect
      .poll(async () => (await storedProperty(page, propertyId))?.value)
      .toEqual({ type: 'float', value: 2.5 })

    // A scrub shows every value live through the preview channel before it commits.
    const appliedBefore = await previewApplyCount(page)
    const scrubLabel = propertyRow(page, 'waveSpeed').getByText('Value', { exact: true })
    const box = await scrubLabel.boundingBox()
    if (box === null) throw new Error('The value label is not rendered')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + SCRUB_DISTANCE_PX, box.y + box.height / 2, {
      steps: SCRUB_STEPS,
    })
    await expect.poll(() => previewApplyCount(page)).toBeGreaterThan(appliedBefore)
    await page.mouse.up()
    await expect
      .poll(async () => (await storedProperty(page, propertyId))?.value)
      .not.toEqual({ type: 'float', value: 2.5 })

    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    expect(await compileCount(page)).toBe(compilesBefore)
  })

  test('invalid rename shows message and keeps old name', async ({ page }) => {
    await seedAutosave(page, TWO_FLOAT_PROPERTIES)
    await page.goto('/')
    const row = propertyRow(page, 'scale')
    await row.getByRole('button', { name: 'Details' }).click()
    const reference = row.getByRole('textbox', { name: 'Reference' })

    for (const invalidName of INVALID_REFERENCE_NAMES) {
      await reference.fill(invalidName)
      await reference.press('Enter')
      const message = row.getByRole('alert')
      await expect(message).toBeVisible()
      await expect(reference).toHaveAttribute('aria-invalid', 'true')
      const messageId = await message.getAttribute('id')
      expect(messageId).not.toBeNull()
      await expect(reference).toHaveAttribute('aria-describedby', new RegExp(messageId ?? ''))
      await expect(reference).toHaveAccessibleDescription(/.+/)
      await page.waitForTimeout(PAST_DEBOUNCE_MS)
      expect((await storedProperty(page, 'scale'))?.name).toBe('scale')
    }

    // Escape reverts what was typed and clears the message.
    await reference.press('Escape')
    await expect(reference).toHaveValue('scale')
    await expect(row.getByRole('alert')).toBeHidden()
    await expect(reference).not.toHaveAttribute('aria-invalid', 'true')

    await reference.fill('tiling')
    await reference.press('Enter')
    await expect.poll(async () => (await storedProperty(page, 'scale'))?.name).toBe('tiling')
    // The label is free text and stays as it was.
    await expect(propertyHandle(page, 'scale')).toBeVisible()
  })

  test('deleting a used property removes its nodes and one undo restores them', async ({
    page,
  }) => {
    await seedAutosave(page, USED_FLOAT_PROPERTY)
    await page.goto('/')
    await expect(canvasNodes(page)).toHaveCount(3)
    await expect.poll(() => readStoredEdgeCount(page)).toBe(2)

    await propertyHandle(page, 'speed').focus()
    await page.keyboard.press('Delete')
    await expect(propertyRow(page, 'speed')).toHaveCount(0)
    await expect(canvasNodes(page)).toHaveCount(1)
    await expect.poll(async () => (await readStoredNodes(page)).length).toBe(1)
    await expect.poll(() => readStoredEdgeCount(page)).toBe(0)

    await page.keyboard.press('ControlOrMeta+z')
    await expect(propertyRow(page, 'speed')).toBeVisible()
    await expect(canvasNodes(page)).toHaveCount(3)
    await expect.poll(() => readStoredEdgeCount(page)).toBe(2)
    await expect.poll(async () => (await readStoredProperties(page)).length).toBe(1)
  })

  test('the delete button removes a property', async ({ page }) => {
    await seedAutosave(page, TWO_FLOAT_PROPERTIES)
    await page.goto('/')
    await propertyRow(page, 'speed').getByRole('button', { name: 'Delete property' }).click()
    await expect(propertyRow(page, 'speed')).toHaveCount(0)
    await expect.poll(async () => (await readStoredProperties(page)).length).toBe(1)
  })

  test('drag property onto canvas creates node at drop point', async ({ page }) => {
    await seedAutosave(page, TWO_FLOAT_PROPERTIES)
    await page.goto('/')
    await expect(canvasNodes(page)).toHaveCount(1)

    const pane = page.locator('.react-flow__pane')
    const paneBox = await pane.boundingBox()
    if (paneBox === null) throw new Error('The canvas is not rendered')
    const drop = { x: paneBox.x + paneBox.width * 0.45, y: paneBox.y + paneBox.height * 0.6 }
    await propertyHandle(page, 'scale').dragTo(pane, {
      targetPosition: { x: drop.x - paneBox.x, y: drop.y - paneBox.y },
    })

    const pill = graphNode(page, 'scale')
    await expect(pill).toBeVisible()
    await expect(pill).toBeFocused()
    const pillBox = await pill.boundingBox()
    if (pillBox === null) throw new Error('The dropped node is not rendered')
    expect(Math.abs(pillBox.x - drop.x)).toBeLessThanOrEqual(DROP_TOLERANCE_PX)
    expect(Math.abs(pillBox.y - drop.y)).toBeLessThanOrEqual(DROP_TOLERANCE_PX)
    await expect.poll(async () => (await readStoredNodes(page)).length).toBe(2)
  })

  test('each kind gets its value editor and a unique default name', async ({ page }) => {
    await page.goto('/')
    for (const kind of ['Color', 'Vector 3', 'Texture', 'Color']) {
      await addPropertyByKeyboard(page, kind)
      await page.keyboard.press('Enter')
    }

    await expect(
      propertyRow(page, 'color1').getByRole('button', { name: 'Color', exact: true }),
    ).toBeVisible()
    await expect(propertyRow(page, 'color2')).toBeVisible()
    await expect(
      propertyRow(page, 'vec3_1').getByRole('textbox', { name: 'Value Z' }),
    ).toBeVisible()
    await expect(
      propertyRow(page, 'texture1').getByRole('button', { name: 'Choose image for Image' }),
    ).toBeVisible()
    await expect(propertyRow(page, 'vec3_1').locator('[data-type-chip]')).toHaveText('vec3')
    await expect(propertyRow(page, 'color1').locator('[data-type-chip]')).toHaveText('color')
  })

  test('arrow keys move between rows and Escape cancels an inline rename', async ({ page }) => {
    await seedAutosave(page, TWO_FLOAT_PROPERTIES)
    await page.goto('/')
    await propertyHandle(page, 'speed').focus()
    await page.keyboard.press('ArrowDown')
    await expect(propertyHandle(page, 'scale')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(propertyHandle(page, 'speed')).toBeFocused()

    await page.keyboard.press('F2')
    const nameField = propertyRow(page, 'speed').getByRole('textbox', { name: 'Property name' })
    await expect(nameField).toBeFocused()
    await page.keyboard.type('nope')
    await page.keyboard.press('Escape')
    await expect(propertyHandle(page, 'speed')).toBeFocused()
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    expect((await storedProperty(page, 'speed'))?.label).toBe('speed')
  })
})
