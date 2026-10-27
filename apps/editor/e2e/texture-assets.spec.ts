import { fileURLToPath } from 'node:url'

import { expect, test, type Locator, type Page } from '@playwright/test'

import { countReddishPixels } from './support/count-reddish-pixels'
import { expectFocusRing, tabUntilFocused } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import {
  AUTOSAVE_KEY,
  SAMPLE_TEXTURE_TO_BASE_COLOR,
  sampleTextureDocument,
  seedAutosave,
} from './support/seed-graph'

const RED_SWATCH_PATH = fileURLToPath(new URL('./fixtures/red-swatch.png', import.meta.url))
/** A lit red sphere shows thousands of reddish pixels; the neutral grey one shows none. */
const MIN_REDDISH_PIXELS = 200
const SHA256_HEX = /^[0-9a-f]{64}$/
const UNKNOWN_ASSET_ID = '0'.repeat(64)

function sampleNode(page: Page): Locator {
  return page.getByRole('group', { name: 'Sample Texture 2D', exact: true })
}

function previewCanvas(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' }).locator('canvas')
}

async function reddishPixels(page: Page): Promise<number> {
  return countReddishPixels(page, await previewCanvas(page).screenshot())
}

async function storedTextureValue(page: Page): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === 'sample')
  return node?.inputValues.texture
}

/** The asset id of the Sample Texture 2D's stored texture, or `null` while none is stored. */
async function storedAssetId(page: Page): Promise<string | null> {
  const value = await storedTextureValue(page)
  if (typeof value !== 'object' || value === null || !('assetId' in value)) return null
  return typeof value.assetId === 'string' ? value.assetId : null
}

test.describe('texture assets', () => {
  test('sample texture 2d with an uploaded image tints the preview', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto('/')
    await expect(previewCanvas(page)).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__nudoCompileCount ?? 0)).toBeGreaterThan(0)
    // No image yet: the neutral grey stands in, so nothing is red.
    expect(await reddishPixels(page)).toBeLessThan(MIN_REDDISH_PIXELS)

    await sampleNode(page).locator('input[type="file"]').setInputFiles(RED_SWATCH_PATH)

    await expect.poll(() => storedAssetId(page)).toMatch(SHA256_HEX)
    await expect.poll(() => reddishPixels(page)).toBeGreaterThan(MIN_REDDISH_PIXELS)
    await expect(sampleNode(page).locator('img')).toBeVisible()
    await expect(sampleNode(page).getByRole('button', { name: /^Change image/ })).toBeVisible()
    await expect(sampleNode(page).getByText('Missing texture')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  test('an uploaded image is still there after a reload', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(
      ([key, document]) => {
        localStorage.setItem(key, document)
      },
      [AUTOSAVE_KEY, SAMPLE_TEXTURE_TO_BASE_COLOR] as const,
    )
    await page.reload()
    await sampleNode(page).locator('input[type="file"]').setInputFiles(RED_SWATCH_PATH)
    await expect.poll(() => reddishPixels(page)).toBeGreaterThan(MIN_REDDISH_PIXELS)

    await page.reload()

    await expect(sampleNode(page).locator('img')).toBeVisible()
    await expect.poll(() => reddishPixels(page)).toBeGreaterThan(MIN_REDDISH_PIXELS)
    await expect(sampleNode(page).getByText('Missing texture')).toHaveCount(0)
  })

  test('missing asset shows badge and preview still renders', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await seedAutosave(page, sampleTextureDocument(UNKNOWN_ASSET_ID))
    await page.goto('/')

    await expect(sampleNode(page).getByText('Missing texture')).toBeVisible()
    await expect(sampleNode(page).getByRole('button', { name: /^Choose image/ })).toBeVisible()
    await expect(previewCanvas(page)).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__nudoCompileCount ?? 0)).toBeGreaterThan(0)
    await expect(page.getByRole('region', { name: 'Main preview' }).getByRole('alert')).toHaveCount(
      0,
    )
    expect(await reddishPixels(page)).toBeLessThan(MIN_REDDISH_PIXELS)
    expect(pageErrors).toEqual([])

    // Choosing an image fixes it.
    await sampleNode(page).locator('input[type="file"]').setInputFiles(RED_SWATCH_PATH)
    await expect(sampleNode(page).getByText('Missing texture')).toHaveCount(0)
    await expect.poll(() => reddishPixels(page)).toBeGreaterThan(MIN_REDDISH_PIXELS)
  })

  test('a file that is not a supported image is refused and the graph is untouched', async ({
    page,
  }) => {
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto('/')

    await sampleNode(page)
      .locator('input[type="file"]')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })

    await expect(sampleNode(page).getByRole('alert')).toHaveText(
      'Use a PNG, JPG, WebP or AVIF image.',
    )
    expect(await storedTextureValue(page)).toBeUndefined()
  })

  test('an image that cannot be decoded gets its own notice and is not committed', async ({
    page,
  }) => {
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto('/')
    // The live region exists before any text appears in it.
    await expect(sampleNode(page).getByRole('status')).toHaveText('')

    await sampleNode(page)
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'broken.png',
        mimeType: 'image/png',
        buffer: Buffer.from('this is not a png'),
      })

    await expect(sampleNode(page).getByRole('alert')).toHaveText("Couldn't read this image.")
    await expect(sampleNode(page).getByText('Missing texture')).toHaveCount(0)
    expect(await storedTextureValue(page)).toBeUndefined()
  })

  test('the image is chosen with the keyboard alone', async ({ page }) => {
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto('/')
    const choose = sampleNode(page).getByRole('button', { name: 'Choose image for Texture' })

    await tabUntilFocused(page, choose)
    await expectFocusRing(page, choose)
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    await (await chooser).setFiles(RED_SWATCH_PATH)

    await expect.poll(() => reddishPixels(page)).toBeGreaterThan(MIN_REDDISH_PIXELS)
    await expect(
      sampleNode(page).getByRole('button', { name: 'Change image for Texture' }),
    ).toBeVisible()
  })
})
