import { readFileSync } from 'node:fs'
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
/** The texture control and its label share one row: their vertical centers sit this close. */
const SAME_ROW_TOLERANCE_PX = 2
/** The red swatch fixture is 16 by 16 pixels. */
const RED_SWATCH_SIZE = '16 × 16'

function sampleNode(page: Page): Locator {
  return page.getByRole('group', { name: 'Sample Texture 2D', exact: true })
}

function textureRow(page: Page): Locator {
  return sampleNode(page).locator('li[data-port-id="texture"]')
}

/** The thumbnail button that opens the file chooser and takes dropped images. */
function textureSlot(page: Page): Locator {
  return textureRow(page).getByRole('button', { name: /^(Choose|Change) image/ })
}

function removeButton(page: Page): Locator {
  return textureRow(page).getByRole('button', { name: /^Remove image/ })
}

async function verticalCenter(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('The element is not rendered')
  return box.y + box.height / 2
}

/** The slot sits on the label's row, not on a line of its own under it. */
async function expectSlotOnLabelRow(page: Page): Promise<void> {
  const label = textureRow(page).getByText('Texture', { exact: true })
  const offset = Math.abs((await verticalCenter(textureSlot(page))) - (await verticalCenter(label)))
  expect(offset).toBeLessThanOrEqual(SAME_ROW_TOLERANCE_PX)
}

/** Drops a file on the slot the way the browser does when one is dragged in from the desktop. */
async function dropFileOnSlot(page: Page, path: string, type: string): Promise<void> {
  const bytes = Array.from(readFileSync(path))
  const dataTransfer = await page.evaluateHandle(
    ({ fileBytes, fileType }) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(fileBytes)], 'dropped.png', { type: fileType }))
      return transfer
    },
    { fileBytes: bytes, fileType: type },
  )
  const slot = textureSlot(page)
  await slot.dispatchEvent('dragenter', { dataTransfer })
  await slot.dispatchEvent('dragover', { dataTransfer })
  await slot.dispatchEvent('drop', { dataTransfer })
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
    await expect(textureSlot(page).locator('img')).toBeVisible()
    await expect(textureSlot(page)).toHaveAccessibleName('Change image for Texture')
    await expect(removeButton(page)).toBeVisible()
    await expect(sampleNode(page).getByText('Missing texture')).toHaveCount(0)
    // The size goes in the tooltip, not as text in the node.
    await textureSlot(page).hover()
    await expect(page.getByRole('tooltip')).toContainText(RED_SWATCH_SIZE)
    await expect(sampleNode(page).getByText(RED_SWATCH_SIZE)).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  test('the texture control sits on its label row in every state', async ({ page }) => {
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto('/')
    await expect(textureSlot(page)).toBeVisible()
    await expectSlotOnLabelRow(page)

    await sampleNode(page).locator('input[type="file"]').setInputFiles(RED_SWATCH_PATH)
    await expect(textureSlot(page).locator('img')).toBeVisible()
    await expectSlotOnLabelRow(page)
    await expect(removeButton(page)).toBeVisible()
    const removeCenter = await verticalCenter(removeButton(page))
    expect(Math.abs(removeCenter - (await verticalCenter(textureSlot(page))))).toBeLessThanOrEqual(
      SAME_ROW_TOLERANCE_PX,
    )
  })

  test('the missing state keeps the control on its label row', async ({ page }) => {
    await seedAutosave(page, sampleTextureDocument(UNKNOWN_ASSET_ID))
    await page.goto('/')
    await expect(sampleNode(page).getByText('Missing texture')).toBeVisible()

    await expectSlotOnLabelRow(page)
  })

  test('dropping an image on the slot uploads it', async ({ page }) => {
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto('/')
    await expect(textureSlot(page)).toHaveAccessibleName('Choose image for Texture')

    await dropFileOnSlot(page, RED_SWATCH_PATH, 'image/png')

    await expect.poll(() => storedAssetId(page)).toMatch(SHA256_HEX)
    await expect(textureSlot(page).locator('img')).toBeVisible()
    await expect.poll(() => reddishPixels(page)).toBeGreaterThan(MIN_REDDISH_PIXELS)
  })

  test('remove clears the image, and one undo brings it back', async ({ page }) => {
    await seedAutosave(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
    await page.goto('/')
    await sampleNode(page).locator('input[type="file"]').setInputFiles(RED_SWATCH_PATH)
    await expect.poll(() => storedAssetId(page)).toMatch(SHA256_HEX)
    const uploadedId = await storedAssetId(page)

    await removeButton(page).click()

    await expect.poll(() => storedAssetId(page)).toBeNull()
    await expect(textureSlot(page).locator('img')).toHaveCount(0)
    await expect(removeButton(page)).toHaveCount(0)
    // The remove button is gone, so focus lands on the slot instead of the page.
    await expect(textureSlot(page)).toBeFocused()
    await expect(textureSlot(page)).toHaveAccessibleName('Choose image for Texture')

    await page.keyboard.press('ControlOrMeta+z')

    await expect.poll(() => storedAssetId(page)).toBe(uploadedId)
    await expect(textureSlot(page).locator('img')).toBeVisible()
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
    await expect(textureSlot(page)).toHaveAccessibleName('Choose image for Texture')
    // Not color alone: the slot shows a warning icon and the row says so in words.
    await expect(textureSlot(page)).toHaveAttribute('data-texture-state', 'missing')
    await expect(textureSlot(page).locator('svg')).toBeVisible()
    await expect(textureRow(page).getByText('Missing', { exact: true })).toBeVisible()
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
    await expect(page.getByRole('tooltip')).toContainText('Choose image')
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    await (await chooser).setFiles(RED_SWATCH_PATH)

    await expect.poll(() => reddishPixels(page)).toBeGreaterThan(MIN_REDDISH_PIXELS)
    await expect(
      sampleNode(page).getByRole('button', { name: 'Change image for Texture' }),
    ).toBeVisible()

    // Remove from the keyboard (it sits just before the slot): focus moves back to the slot.
    await expect(textureSlot(page)).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(removeButton(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(choose).toBeFocused()
    await expect.poll(() => storedAssetId(page)).toBeNull()
  })
})
