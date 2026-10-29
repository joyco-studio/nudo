import { fileURLToPath } from 'node:url'

import { expect, test, type Locator, type Page } from '@playwright/test'

import { countReddishPixels } from './support/count-reddish-pixels'
import { pickExampleByKeyboard, templatesBrowser, templatesButton } from './support/open-example'
import { readStoredNodes } from './support/read-autosave'
import { SAMPLE_TEXTURE_TO_BASE_COLOR, seedAutosave } from './support/seed-graph'
import { luminanceSpread } from './support/luminance-spread'
import { toasts } from './support/toasts'

/** The dev server lists the end-to-end fixture templates only with this query. */
const FIXTURES_URL = '/?template-fixtures'
const FIXTURE_TITLE = 'Paper grain (test fixture)'
/** The fixture's Sample Texture 2D, whose slot the template's paper grain fills. */
const GRAIN_NODE_ID = 'grain'
/**
 * The paper grain's image request. Not the module that exports its URL, which the dev server
 * serves from the same path with `?import`: failing that one would break the whole page.
 */
const isGrainImageRequest = (url: URL): boolean =>
  url.pathname.endsWith('/paper-grain.png') && !url.searchParams.has('import')
const SHA256_HEX = /^[0-9a-f]{64}$/
const UNDO_CHORD = 'ControlOrMeta+z'
const RED_SWATCH_PATH = fileURLToPath(new URL('./fixtures/red-swatch.png', import.meta.url))
/** A lit red sphere shows thousands of reddish pixels; the grey paper grain shows none. */
const MIN_REDDISH_PIXELS = 200
/**
 * The middle of a preview, where the plane sits: the paper grain spreads its luminance well past
 * this, while the flat grey stand-in for a missing texture stays under it.
 */
const MIN_GRAIN_SPREAD = 6
const CENTER_SHARE = 0.3
const FIRST_PICTURE_TIMEOUT_MS = 15_000

function confirmDialog(page: Page): Locator {
  return page.getByRole('alertdialog')
}

function graphNode(page: Page, id: string): Locator {
  return page.locator(`.react-flow__node[data-id="${id}"]`)
}

/** The texture slot (thumbnail button) of a Sample Texture 2D node. */
function textureSlot(page: Page, nodeId: string): Locator {
  return graphNode(page, nodeId)
    .locator('li[data-port-id="texture"]')
    .getByRole('button', { name: /^(Choose|Change) image/ })
}

function mainPreviewCanvas(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' }).locator('canvas')
}

function templatePreview(page: Page): Locator {
  return templatesBrowser(page).locator('[data-template-preview]')
}

/** The luminance spread of the middle of a canvas, where the previewed plane is. */
async function centerSpread(page: Page, canvas: Locator): Promise<number> {
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('The canvas is not rendered')
  const clip = {
    x: box.x + box.width * CENTER_SHARE,
    y: box.y + box.height * CENTER_SHARE,
    width: box.width * (1 - 2 * CENTER_SHARE),
    height: box.height * (1 - 2 * CENTER_SHARE),
  }
  return luminanceSpread(page, await page.screenshot({ clip }))
}

/** The ids in the IndexedDB asset store; empty when the editor never opened it. */
async function storedAssetIds(page: Page): Promise<readonly string[]> {
  return page.evaluate(async () => {
    // Opening a database that doesn't exist would create it without its store: check first.
    const databases = await indexedDB.databases()
    if (!databases.some((database) => database.name === 'nudo-tsl')) return []
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nudo-tsl')
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(new Error('IndexedDB did not open'))
      }
    })
    if (!database.objectStoreNames.contains('assets')) return []
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = database.transaction('assets').objectStore('assets').getAllKeys()
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(new Error('The asset keys did not read'))
      }
    })
    database.close()
    return keys.map(String)
  })
}

/** The asset id the autosaved graph stores in a node's texture slot, or null. */
async function storedSlotAssetId(page: Page, nodeId: string): Promise<string | null> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  const value = node?.inputValues.texture
  if (typeof value !== 'object' || value === null || !('assetId' in value)) return null
  return typeof value.assetId === 'string' ? value.assetId : null
}

/** Opens the fixture from the browser; confirms the replacement when the graph has work in it. */
async function openFixture(page: Page, { confirm }: { confirm: boolean }): Promise<void> {
  await pickExampleByKeyboard(page, FIXTURE_TITLE)
  if (confirm) {
    await confirmDialog(page).getByRole('button', { name: 'Open template' }).click()
    await expect(confirmDialog(page)).toBeHidden()
  }
  await expect(templatesBrowser(page)).toBeHidden()
  await expect(graphNode(page, GRAIN_NODE_ID)).toBeVisible()
}

/** Holds the paper grain's image request back until the returned function lets it through. */
async function holdGrainImage(page: Page): Promise<() => void> {
  let release: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(isGrainImageRequest, async (route) => {
    await released
    await route.continue()
  })
  return release
}

async function expectGrainInSlotAndPreview(page: Page): Promise<void> {
  await expect(textureSlot(page, GRAIN_NODE_ID).locator('img')).toBeVisible()
  await expect(textureSlot(page, GRAIN_NODE_ID)).toHaveAccessibleName('Change image for Texture')
  await expect(graphNode(page, GRAIN_NODE_ID).getByText('Missing')).toHaveCount(0)
  await expect
    .poll(() => centerSpread(page, mainPreviewCanvas(page)), { timeout: FIRST_PICTURE_TIMEOUT_MS })
    .toBeGreaterThan(MIN_GRAIN_SPREAD)
}

test.describe('templates that bundle textures', () => {
  test('the browser previews the template with its texture, and stores nothing', async ({
    page,
  }) => {
    await page.goto(FIXTURES_URL)
    await templatesButton(page).click()
    await templatesBrowser(page).getByRole('option', { name: FIXTURE_TITLE }).click()

    await expect(templatePreview(page)).toHaveAttribute('data-shown-template', 'texture-fixture')
    await expect(templatePreview(page)).toHaveAttribute('data-status', 'ready')
    await expect
      .poll(() => centerSpread(page, templatePreview(page).locator('canvas')), {
        timeout: FIRST_PICTURE_TIMEOUT_MS,
      })
      .toBeGreaterThan(MIN_GRAIN_SPREAD)
    expect(await storedAssetIds(page)).toEqual([])
  })

  test('opening stores the texture once and fills the slot and the preview; reopening adds nothing', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(FIXTURES_URL)

    await openFixture(page, { confirm: false })
    await expectGrainInSlotAndPreview(page)
    await expect.poll(() => storedSlotAssetId(page, GRAIN_NODE_ID)).toMatch(SHA256_HEX)
    const assetId = await storedSlotAssetId(page, GRAIN_NODE_ID)
    expect(await storedAssetIds(page)).toEqual([assetId])

    await openFixture(page, { confirm: true })
    await expectGrainInSlotAndPreview(page)
    expect(await storedSlotAssetId(page, GRAIN_NODE_ID)).toBe(assetId)
    expect(await storedAssetIds(page)).toEqual([assetId])
    expect(pageErrors).toEqual([])
  })

  test('undo brings back the graph before the template, with its own texture', async ({ page }) => {
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto(FIXTURES_URL)
    await graphNode(page, 'sample').locator('input[type="file"]').setInputFiles(RED_SWATCH_PATH)
    await expect.poll(() => storedSlotAssetId(page, 'sample')).toMatch(SHA256_HEX)
    const swatchId = await storedSlotAssetId(page, 'sample')
    await expect
      .poll(async () => countReddishPixels(page, await mainPreviewCanvas(page).screenshot()))
      .toBeGreaterThan(MIN_REDDISH_PIXELS)

    await openFixture(page, { confirm: true })
    await expectGrainInSlotAndPreview(page)
    await expect(graphNode(page, 'sample')).toHaveCount(0)

    await page.getByRole('main', { name: 'Node canvas' }).focus()
    await page.keyboard.press(UNDO_CHORD)

    await expect(graphNode(page, GRAIN_NODE_ID)).toHaveCount(0)
    await expect(textureSlot(page, 'sample').locator('img')).toBeVisible()
    await expect.poll(() => storedSlotAssetId(page, 'sample')).toBe(swatchId)
    await expect
      .poll(async () => countReddishPixels(page, await mainPreviewCanvas(page).screenshot()))
      .toBeGreaterThan(MIN_REDDISH_PIXELS)
    // Both images stay stored: the template's, for redo, and the one chosen before.
    expect([...(await storedAssetIds(page))].sort()).toHaveLength(2)
  })

  test('a texture that does not load opens as missing, with a notice', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.route(isGrainImageRequest, (route) => route.fulfill({ status: 404 }))
    await page.goto(FIXTURES_URL)

    await openFixture(page, { confirm: false })

    await expect(graphNode(page, GRAIN_NODE_ID).getByText('Missing')).toBeVisible()
    await expect(textureSlot(page, GRAIN_NODE_ID)).toHaveAccessibleName('Choose image for Texture')
    await expect(toasts(page)).toContainText("Some of the template's images didn't load.")
    await expect
      .poll(() => centerSpread(page, mainPreviewCanvas(page)))
      .toBeLessThan(MIN_GRAIN_SPREAD)
    expect(await storedAssetIds(page)).toEqual([])
    expect(pageErrors).toEqual([])
  })

  test('the browser stays open, Open busy, until the texture is in', async ({ page }) => {
    const releaseGrain = await holdGrainImage(page)
    await page.goto(FIXTURES_URL)
    const browser = templatesBrowser(page)

    await pickExampleByKeyboard(page, FIXTURE_TITLE)

    const openButton = browser.getByRole('button', { name: 'Opening…' })
    await expect(openButton).toHaveAttribute('aria-busy', 'true')
    await expect(browser).toBeVisible()
    await expect(graphNode(page, GRAIN_NODE_ID)).toHaveCount(0)

    releaseGrain()
    await expect(browser).toBeHidden()
    await expectGrainInSlotAndPreview(page)
    await expect(templatesButton(page)).toBeFocused()
  })

  test('closing the browser while the texture loads gives up on the template', async ({ page }) => {
    const releaseGrain = await holdGrainImage(page)
    await page.goto(FIXTURES_URL)

    await pickExampleByKeyboard(page, FIXTURE_TITLE)
    await expect(templatesBrowser(page).getByRole('button', { name: 'Opening…' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(templatesBrowser(page)).toBeHidden()

    releaseGrain()
    // The texture still lands (stored once, like any open), but the graph stays as it was.
    await expect.poll(() => storedAssetIds(page)).toHaveLength(1)
    await expect(graphNode(page, GRAIN_NODE_ID)).toHaveCount(0)
    await expect(templatesButton(page)).toBeFocused()
  })
})
