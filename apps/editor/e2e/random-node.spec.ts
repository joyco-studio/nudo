import { expect, test, type Locator, type Page } from '@playwright/test'

import { readStoredNodes } from './support/read-autosave'
import { COLOR_TO_BASE_COLOR, graphDocument, seedAutosave } from './support/seed-graph'

/** Mirrors `LOCALE_STORAGE_KEY` in src/i18n/locale.ts. */
const LOCALE_STORAGE_KEY = 'nudo-tsl:locale'

/** Two Random nodes on their own: the mesh UV feeds both, only the seed differs. */
const TWO_SEEDS = graphDocument(
  [
    { id: 'first', type: 'math/hash', position: { x: 0, y: 40 } },
    {
      id: 'second',
      type: 'math/hash',
      position: { x: 300, y: 40 },
      inputValues: { seed: { type: 'float', value: 1 } },
    },
  ],
  [],
)

/** Uniform noise has a luminance spread of about 74; a smooth gradient or a flat fill has far less. */
const MIN_NOISE_SPREAD = 50
/** Uniform noise differs from its right-hand neighbor by a third of the range on average (85). */
const MIN_NEIGHBOR_DIFFERENCE = 60
/** Uniform noise over a preview's pixels reaches close to both ends of the 0 to 255 range. */
const NEAR_BLACK = 12
const NEAR_WHITE = 243
/** A single Random node's own preview and the wait before reading it again. */
const FRAME_GAP_MS = 300
/** The share of pixels two unrelated noise fields may happen to share to within a level or so. */
const MAX_SHARED_PIXELS = 0.1
const SHARED_PIXEL_TOLERANCE = 8

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('main', { name: 'Node canvas' }).getByRole('group', { name, exact: true })
}

function previewOf(page: Page, nodeName: string): Locator {
  return graphNode(page, nodeName).getByRole('img', { name: `${nodeName} preview`, exact: true })
}

/** The red channel of every pixel of a preview canvas, row by row, read from its 2D context. */
async function readChannel(preview: Locator): Promise<{ width: number; values: number[] }> {
  return preview.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas')
    const context = element.getContext('2d')
    if (context === null) throw new Error('No 2D context')
    const { data } = context.getImageData(0, 0, element.width, element.height)
    const values: number[] = []
    for (let index = 0; index < data.length; index += 4) values.push(data[index] ?? 0)
    return { width: element.width, values }
  })
}

const meanOf = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length

const spreadOf = (values: readonly number[]): number => {
  const mean = meanOf(values)
  return Math.sqrt(meanOf(values.map((value) => (value - mean) ** 2)))
}

function neighborDifference(width: number, values: readonly number[]): number {
  const differences = values.flatMap((value, index) =>
    (index + 1) % width === 0 ? [] : [Math.abs(value - (values[index + 1] ?? value))],
  )
  return meanOf(differences)
}

/** Waits until the preview has drawn something other than its empty first frame. */
async function readDrawnPreview(preview: Locator): Promise<{ width: number; values: number[] }> {
  await expect(preview).toBeVisible()
  await expect.poll(async () => spreadOf((await readChannel(preview)).values)).toBeGreaterThan(1)
  return readChannel(preview)
}

test.describe('random node', () => {
  test('the add-node menu finds it as "random" and adds it', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await expect(page.locator('.react-flow__edge-path').first()).toBeVisible()
    await graphNode(page, 'Color').focus()
    await page.keyboard.press('Space')

    const dialog = page.getByRole('dialog', { name: 'Add node' })
    await page.keyboard.type('random')
    await expect(dialog.getByRole('option', { name: /^Random/ })).toBeVisible()
    await dialog.getByRole('option', { name: /^Random/ }).click()

    await expect(dialog).toBeHidden()
    await expect(graphNode(page, 'Random')).toBeVisible()
    await expect
      .poll(async () => (await readStoredNodes(page)).some((node) => node.type === 'math/hash'))
      .toBe(true)
    expect(pageErrors).toEqual([])
  })

  test('the add-node menu finds it as "aleatorio" in Spanish', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'es')
    }, LOCALE_STORAGE_KEY)
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.goto('/')
    await expect(page.locator('.react-flow__edge-path').first()).toBeVisible()
    await page.getByRole('banner').getByRole('button', { name: 'Agregar nodo' }).click()

    const dialog = page.getByRole('dialog', { name: 'Agregar nodo' })
    await dialog.getByRole('combobox', { name: 'Buscar nodos' }).fill('aleatorio')
    await expect(dialog.getByRole('option', { name: /^Aleatorio/ })).toBeVisible()
    await dialog.getByRole('option', { name: /^Aleatorio/ }).click()

    await expect(dialog).toBeHidden()
    await expect(
      page.getByRole('main', { name: 'Lienzo de nodos' }).getByRole('group', { name: 'Aleatorio' }),
    ).toBeVisible()
  })

  test('its preview is white noise that holds still, and a new seed gives a new pattern', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await seedAutosave(page, TWO_SEEDS)
    await page.goto('/')

    const firstPreview = previewOf(page, 'Random').first()
    const first = await readDrawnPreview(firstPreview)

    expect(spreadOf(first.values)).toBeGreaterThan(MIN_NOISE_SPREAD)
    expect(Math.min(...first.values)).toBeLessThan(NEAR_BLACK)
    expect(Math.max(...first.values)).toBeGreaterThan(NEAR_WHITE)
    expect(neighborDifference(first.width, first.values)).toBeGreaterThan(MIN_NEIGHBOR_DIFFERENCE)
    await page.waitForTimeout(FRAME_GAP_MS)
    expect((await readChannel(firstPreview)).values).toEqual(first.values)

    const second = await readDrawnPreview(previewOf(page, 'Random').nth(1))
    const shared = first.values.filter(
      (value, index) => Math.abs(value - (second.values[index] ?? value)) <= SHARED_PIXEL_TOLERANCE,
    )
    expect(shared.length / first.values.length).toBeLessThan(MAX_SHARED_PIXELS)
    expect(pageErrors).toEqual([])
  })
})
