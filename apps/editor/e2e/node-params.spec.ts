import { expect, test, type Locator, type Page } from '@playwright/test'

import { readStoredNodes } from './support/read-autosave'
import { TIME_TO_SINE, graphDocument, graphDocumentV2, seedAutosave } from './support/seed-graph'

/** Longer than the compile debounce (150 ms), so a pending rebuild would have fired by then. */
const PAST_DEBOUNCE_MS = 500
const UNLIT_HINT = 'Unlit ignores this'
const COMMENT_DEFAULT_WIDTH = 320
const COMMENT_RESIZE_STEP = 20

/** A node on the canvas (the Properties panel has groups named after properties too). */
function graphNode(page: Page, name: string): Locator {
  return page.getByRole('main', { name: 'Node canvas' }).getByRole('group', { name, exact: true })
}

function port(node: Locator, portId: string): Locator {
  return node.locator(`[data-port-id="${portId}"]`)
}

async function compileCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoCompileCount ?? 0)
}

async function storedParams(
  page: Page,
  nodeId: string,
): Promise<Readonly<Record<string, unknown>>> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  return node?.params ?? {}
}

/** Waits until the first compile ran, so later counts only measure what the test did. */
async function waitForFirstCompile(page: Page): Promise<void> {
  await expect.poll(async () => compileCount(page)).toBeGreaterThan(0)
  await page.waitForTimeout(PAST_DEBOUNCE_MS)
}

const SELECT_TO_ROUGHNESS = graphDocument(
  [{ id: 'select', type: 'logic/select', position: { x: 200, y: 0 } }],
  [{ id: 'select-to-roughness', from: ['select', 'out'], to: ['master', 'roughness'] }],
)

const WAVE_SPEED_PROPERTY = graphDocumentV2(
  [
    {
      id: 'reader',
      type: 'property/float',
      position: { x: 200, y: 40 },
      params: { propertyId: 'wave-speed' },
    },
  ],
  [{ id: 'reader-to-roughness', from: ['reader', 'out'], to: ['master', 'roughness'] }],
  [
    {
      id: 'wave-speed',
      label: 'Wave speed',
      name: 'waveSpeed',
      exposed: true,
      type: 'float',
      value: { type: 'float', value: 0.4 },
    },
  ],
)

test('select node op changes via keyboard and recompiles', async ({ page }) => {
  await seedAutosave(page, SELECT_TO_ROUGHNESS)
  await page.goto('/')
  await waitForFirstCompile(page)
  const compilesBefore = await compileCount(page)

  const compare = graphNode(page, 'Select').getByRole('combobox', { name: 'Compare' })
  await compare.focus()
  // Type-ahead on the closed select picks the option that starts with the character.
  await page.keyboard.press('>')
  await expect(compare).toHaveText('>')

  await expect.poll(async () => (await storedParams(page, 'select')).op).toBe('gt')
  await expect.poll(async () => compileCount(page)).toBeGreaterThan(compilesBefore)

  // Escape leaves the select and returns to the node, like any other field.
  await page.keyboard.press('Escape')
  await expect(graphNode(page, 'Select')).toBeFocused()
})

test('unlit disables metalness/roughness/normal rows', async ({ page }) => {
  await page.goto('/')
  const master = graphNode(page, 'Master Stack')
  await expect(master.getByText(UNLIT_HINT)).toHaveCount(0)

  const lighting = master.getByRole('combobox', { name: 'Lighting' })
  await lighting.focus()
  await page.keyboard.press('u')
  await expect(lighting).toHaveText('Unlit')

  for (const portId of ['metalness', 'roughness', 'normal']) {
    const row = port(master, portId)
    await expect(row).toContainText(UNLIT_HINT)
    await expect(row).toHaveAttribute('data-disabled', 'true')
  }
  await expect(master.getByRole('textbox', { name: 'Roughness', exact: true })).toHaveCount(0)
  await expect(port(master, 'opacity')).not.toContainText(UNLIT_HINT)
  await expect.poll(async () => (await storedParams(page, 'master')).lighting).toBe('unlit')
})

test('master shows its alpha clip as off while unconnected', async ({ page }) => {
  await page.goto('/')
  await expect(port(graphNode(page, 'Master Stack'), 'alphaClip')).toContainText('Off')
})

test('property node renders as a pill', async ({ page }) => {
  await seedAutosave(page, WAVE_SPEED_PROPERTY)
  await page.goto('/')
  const pill = graphNode(page, 'Wave speed')
  await expect(pill).toBeVisible()
  await expect(pill).toContainText('Wave speed')
  await expect(pill.locator('[data-type-chip]')).toHaveText('float')
  await expect(pill.locator('header')).toHaveCount(0)
  await expect(pill.locator('[data-port-id]')).toHaveCount(1)
  await expect(port(pill, 'out').getByRole('button')).toBeVisible()

  // Selection and focus work like any node.
  await pill.click()
  await expect(pill).toHaveClass(/selected/)
})

test('collapsing a node hides unconnected ports and does not recompile', async ({ page }) => {
  await seedAutosave(page, TIME_TO_SINE)
  await page.goto('/')
  await waitForFirstCompile(page)
  const compilesBefore = await compileCount(page)
  const sine = graphNode(page, 'Sine')
  const chevron = sine.getByRole('button', { name: 'Unconnected ports' })
  await expect(chevron).toHaveAttribute('aria-expanded', 'true')
  await expect(port(sine, 'out')).toBeVisible()

  await chevron.focus()
  await page.keyboard.press('Enter')
  await expect(chevron).toHaveAttribute('aria-expanded', 'false')
  await expect(port(sine, 'out')).toHaveCount(0)
  await expect(port(sine, 'in')).toBeVisible()
  await expect.poll(async () => (await storedParams(page, 'sine')).collapsed).toBe(true)

  await page.waitForTimeout(PAST_DEBOUNCE_MS)
  expect(await compileCount(page)).toBe(compilesBefore)

  await page.getByRole('main', { name: 'Node canvas' }).focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(port(sine, 'out')).toBeVisible()
})

test('comment node can be added, titled and resized by keyboard', async ({ page }) => {
  await seedAutosave(page, TIME_TO_SINE)
  await page.goto('/')
  await expect(graphNode(page, 'Sine')).toBeVisible()
  await page.getByRole('main', { name: 'Node canvas' }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.type('comment')
  await page.keyboard.press('Enter')

  const frame = graphNode(page, 'Comment')
  await expect(frame).toBeFocused()
  // Enter writes in the note; the title is the first stop inside the frame.
  await page.keyboard.press('Tab')
  const title = frame.getByRole('textbox', { name: 'Comment title' })
  await expect(title).toBeFocused()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Waves')
  await page.keyboard.press('Enter')
  const renamed = graphNode(page, 'Waves')
  await expect(renamed).toBeVisible()
  const renamedTitle = renamed.getByRole('textbox', { name: 'Comment title' })
  await expect(renamedTitle).toBeFocused()

  // Escape reverts an edit that was not committed, and returns to the frame.
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Discarded')
  await page.keyboard.press('Escape')
  await expect(renamedTitle).toHaveValue('Waves')
  await expect(renamed).toBeFocused()

  const commentId = await renamed.getAttribute('data-id')
  expect(commentId).not.toBeNull()
  const widthBefore = (await renamed.boundingBox())?.width ?? 0
  await page.keyboard.press('Alt+ArrowRight')
  await expect
    .poll(async () => (await storedParams(page, String(commentId))).width)
    .toBe(COMMENT_DEFAULT_WIDTH + COMMENT_RESIZE_STEP)
  await expect
    .poll(async () => (await renamed.boundingBox())?.width ?? 0)
    .toBeGreaterThan(widthBefore)

  // The frame sits behind the other nodes.
  const frameZ = Number(await renamed.evaluate((element) => getComputedStyle(element).zIndex))
  const sineZ = Number(
    await graphNode(page, 'Sine').evaluate((element) => getComputedStyle(element).zIndex),
  )
  expect(frameZ).toBeLessThan(sineZ)

  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await storedParams(page, String(commentId))).width).toBeUndefined()
})

test('Alt+Arrow on a node that is not a frame is left to the browser', async ({ page }) => {
  await seedAutosave(page, TIME_TO_SINE)
  await page.goto('/')
  const sine = graphNode(page, 'Sine')
  await sine.focus()
  await page.evaluate(() => {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        document.body.dataset.lastKeyPrevented = String(event.defaultPrevented)
      }
    })
  })

  await page.keyboard.press('Alt+ArrowRight')

  await expect(page.locator('body')).toHaveAttribute('data-last-key-prevented', 'false')
  await expect.poll(async () => (await storedParams(page, 'sine')).width).toBeUndefined()
})

test('dragging a comment resize handle commits the size as one undo step', async ({ page }) => {
  await seedAutosave(
    page,
    graphDocument([{ id: 'note', type: 'utility/comment', position: { x: 0, y: 0 } }], []),
  )
  await page.goto('/')
  const frame = graphNode(page, 'Comment')
  await frame.click({ position: { x: 100, y: 100 } })
  const handle = frame.locator('.react-flow__resize-control.handle.bottom.right')
  const box = await handle.boundingBox()
  if (box === null) throw new Error('Resize handle has no bounding box')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 8 })
  await page.mouse.up()
  await expect
    .poll(async () => (await storedParams(page, 'note')).width)
    .toBeGreaterThan(COMMENT_DEFAULT_WIDTH)

  await page.getByRole('main', { name: 'Node canvas' }).focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await storedParams(page, 'note')).width).toBeUndefined()
})
