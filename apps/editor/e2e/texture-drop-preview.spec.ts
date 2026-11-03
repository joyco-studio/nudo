import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

import { countReddishPixels } from './support/count-tinted-pixels'
import { waitForAutosave } from './support/pending-work'
import { readStoredProperties } from './support/read-autosave'
import {
  graphDocumentV2,
  SAMPLE_TEXTURE_TO_BASE_COLOR,
  seedAutosaveOnce,
} from './support/seed-graph'

const RED = readFileSync(new URL('./fixtures/red-swatch.png', import.meta.url)).toString('base64')
const CLEAR = readFileSync(new URL('./fixtures/transparent-swatch.png', import.meta.url)).toString(
  'base64',
)

/** A real browser File and DataTransfer, matching the payload of a file dragged from Finder. */
async function fileDrag(page: Page, base64: string, name = 'image.png', type = 'image/png') {
  return page.evaluateHandle(
    ({ base64, name, type }) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], name, { type }))
      return transfer
    },
    { base64, name, type },
  )
}

const PROPERTY_GRAPH = graphDocumentV2(
  [
    {
      id: 'image',
      type: 'property/texture',
      position: { x: 0, y: 0 },
      params: { propertyId: 'wallpaper' },
    },
    { id: 'sample', type: 'texture/sample-texture-2d', position: { x: 300, y: 0 } },
  ],
  [
    { id: 'image-sample', from: ['image', 'out'], to: ['sample', 'texture'] },
    { id: 'sample-master', from: ['sample', 'rgb'], to: ['master', 'baseColor'] },
  ],
  [
    {
      id: 'wallpaper',
      name: 'wallpaper',
      label: 'Wallpaper image',
      exposed: true,
      type: 'texture',
      value: { type: 'texture', assetId: null },
    },
  ],
)

test('Finder file drops replace an image across the whole property and survive reload', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await seedAutosaveOnce(page, PROPERTY_GRAPH)
  await page.goto('/')
  const property = page
    .getByRole('region', { name: 'Properties', exact: true })
    .getByRole('group', { name: 'Wallpaper image', exact: true })
  const slot = property.locator('[data-texture-state]')
  const canvas = page.getByRole('region', { name: 'Main preview' }).locator('canvas')
  await expect(slot).toHaveAttribute('data-texture-state', 'empty')
  const red = await fileDrag(page, RED)
  // Drop on the property label, outside the thumbnail's original tiny hit area.
  const label = property.locator('[data-property-handle]')
  await label.dispatchEvent('dragenter', { dataTransfer: red })
  await label.dispatchEvent('dragover', { dataTransfer: red })
  await expect(property).toHaveAttribute('data-drop-target', 'true')
  await label.dispatchEvent('drop', { dataTransfer: red })
  await expect(property).not.toHaveAttribute('data-drop-target')
  await expect(slot).toHaveAttribute('data-texture-state', 'ready')
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()))
    .toBeGreaterThan(1000)
  await waitForAutosave(page)
  const original = (await readStoredProperties(page))[0]?.value

  const clear = await fileDrag(page, CLEAR, 'replacement.png')
  await property.dispatchEvent('dragenter', { dataTransfer: clear })
  await slot.dispatchEvent('dragenter', { dataTransfer: clear })
  await slot.dispatchEvent('dragleave', { dataTransfer: clear })
  await expect(property).toHaveAttribute('data-drop-target', 'true')
  await property.screenshot({ path: test.info().outputPath('image-drop-target.png') })
  await slot.dispatchEvent('drop', { dataTransfer: clear })
  await expect(property).not.toHaveAttribute('data-drop-target')
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()))
    .toBeLessThan(10)
  await waitForAutosave(page)
  const replacement = (await readStoredProperties(page))[0]?.value
  expect(replacement).not.toEqual(original)

  // A thumbnail drop is handled once, even inside the larger property target.
  await page.getByRole('button', { name: 'Templates', exact: true }).focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()))
    .toBeGreaterThan(1000)
  await waitForAutosave(page)
  expect((await readStoredProperties(page))[0]?.value).toEqual(original)

  const invalid = await fileDrag(page, btoa('not an image'), 'notes.txt', 'text/plain')
  await property.dispatchEvent('drop', { dataTransfer: invalid })
  await expect(property.getByRole('alert')).toHaveText('Use a PNG, JPG, WebP or AVIF image.')
  expect((await readStoredProperties(page))[0]?.value).toEqual(original)
  const corrupt = await fileDrag(page, btoa('not a png'), 'broken.png')
  await property.dispatchEvent('drop', { dataTransfer: corrupt })
  await expect(property.getByRole('alert')).toHaveText("Couldn't read this image.")
  expect((await readStoredProperties(page))[0]?.value).toEqual(original)

  const propertyDrag = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.setData('application/x-nudo-property', 'wallpaper')
    return transfer
  })
  await property.dispatchEvent('dragenter', { dataTransfer: propertyDrag })
  await property.dispatchEvent('drop', { dataTransfer: propertyDrag })
  await expect(property).not.toHaveAttribute('data-drop-target')
  await property.dispatchEvent('dragenter', { dataTransfer: clear })
  await property.dispatchEvent('dragleave', { dataTransfer: clear })
  await expect(property).not.toHaveAttribute('data-drop-target')
  await property.dispatchEvent('drop', { dataTransfer: clear })
  await expect(property.getByRole('alert')).toHaveCount(0)
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()))
    .toBeLessThan(10)
  await waitForAutosave(page)
  await page.reload()
  await expect(slot).toHaveAttribute('data-texture-state', 'ready')
  expect((await readStoredProperties(page))[0]?.value).toEqual(replacement)
  expect(errors).toEqual([])
  await Promise.all([
    red.dispose(),
    clear.dispose(),
    invalid.dispose(),
    corrupt.dispose(),
    propertyDrag.dispose(),
  ])
})

test('a texture node thumbnail still accepts a file drop', async ({ page }) => {
  await seedAutosaveOnce(page, SAMPLE_TEXTURE_TO_BASE_COLOR)
  await page.goto('/')
  const slot = page
    .getByRole('group', { name: 'Sample Texture 2D', exact: true })
    .locator('[data-texture-state]')
  const red = await fileDrag(page, RED)
  await slot.dispatchEvent('dragenter', { dataTransfer: red })
  await expect(slot).toHaveAttribute('data-drop-target', 'true')
  await slot.dispatchEvent('drop', { dataTransfer: red })
  await expect(slot).not.toHaveAttribute('data-drop-target')
  await expect(slot).toHaveAttribute('data-texture-state', 'ready')
  const canvas = page.getByRole('region', { name: 'Main preview' }).locator('canvas')
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()))
    .toBeGreaterThan(1000)
  await red.dispose()
})
