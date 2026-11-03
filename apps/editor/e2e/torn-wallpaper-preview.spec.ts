import { expect, test, type Locator, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

import { countReddishPixels } from './support/count-tinted-pixels'
import { readStoredNodes } from './support/read-autosave'

import {
  firstSettledCompileCount,
  settledCompileCount,
  waitForAutosave,
} from './support/pending-work'

/** Measure the exposed wall, excluding the green wallpaper, cream curls and dark backdrop. */
async function exposedWall(
  page: Page,
  canvas: Locator,
  bounds = { left: 0, top: 0, right: 1, bottom: 1 },
): Promise<{ share: number; x: number }> {
  const png = (await canvas.screenshot()).toString('base64')
  return page.evaluate(
    async ({ base64, bounds }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const surface = document.createElement('canvas')
      surface.width = image.width
      surface.height = image.height
      const context = surface.getContext('2d')
      if (context === null) throw new Error('No image context')
      context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, image.width, image.height)
      let count = 0
      let sumX = 0
      let total = 0
      for (let pixel = 0; pixel < image.width * image.height; pixel++) {
        const x = (pixel % image.width) / image.width
        const y = Math.floor(pixel / image.width) / image.height
        if (x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom) continue
        total++
        const r = data[pixel * 4] ?? 0
        const g = data[pixel * 4 + 1] ?? 0
        const b = data[pixel * 4 + 2] ?? 0
        if (r > 215 && Math.abs(r - g) < 7 && Math.abs(g - b) < 7) {
          count++
          sumX += x
        }
      }
      return { share: count / Math.max(total, 1), x: sumX / Math.max(count, 1) }
    },
    { base64: png, bounds },
  )
}

test('torn wallpaper supports live tear controls and a persistent uploaded wallpaper image', async ({
  page,
}) => {
  // Several cold software-WebGL compilations plus persistent texture uploads and reloads.
  test.setTimeout(90_000)
  const errors: string[] = []
  const imageRequests: string[] = []
  page.on('request', (request) => {
    // Vite imports URL strings for other templates as JS; only count actual asset reads.
    if (request.url().includes('/examples/textures/') && request.resourceType() !== 'script')
      imageRequests.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /shader|webgl|webgpu|tsl/i.test(message.text()))
      errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico'))
      errors.push(response.url())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('option', { name: /^Torn wallpaper/ }).click()
  await page.getByRole('button', { name: 'Open template', exact: true }).click()

  const preview = page.getByRole('region', { name: 'Main preview' })
  const canvas = preview.locator('canvas')
  await expect(preview.getByRole('radio', { name: 'Plane', exact: true })).toBeChecked()
  const properties = page.getByRole('region', { name: 'Properties', exact: true })
  const innerWall = properties.getByRole('group', { name: 'Inner wall image', exact: true })
  await expect(innerWall.locator('[data-texture-state]')).toHaveAttribute(
    'data-texture-state',
    'ready',
  )
  await expect(
    properties
      .getByRole('group', { name: 'Wallpaper image', exact: true })
      .locator('[data-texture-state]'),
  ).toHaveAttribute('data-texture-state', 'ready')
  await firstSettledCompileCount(page)
  await canvas.screenshot({ path: test.info().outputPath('wallpaper-default.png') })
  // Inspect the input textures and tear boundary at full size, beyond the docked preview.
  const viewport = page.viewportSize()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.getByRole('radio', { name: 'Full', exact: true }).click()
  await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(700)
  await canvas.screenshot({ path: test.info().outputPath('wallpaper-grain-large.png') })
  await page.getByRole('radio', { name: 'Docked', exact: true }).click()
  if (viewport) await page.setViewportSize(viewport)
  // Use a transparent image to measure the tear independently of the concrete's colors.
  await innerWall
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/transparent-swatch.png', import.meta.url)))
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(0.15)
  const compiles = await firstSettledCompileCount(page)
  const original = await exposedWall(page, canvas)
  const region = properties.getByRole('group', {
    name: 'Tear region · XY center / ZW size',
    exact: true,
  })
  const x = region.getByRole('textbox').nth(0)
  await x.fill('0.3')
  await x.press('Enter')
  await expect.poll(async () => (await exposedWall(page, canvas)).x).toBeLessThan(original.x - 0.1)
  await canvas.screenshot({ path: test.info().outputPath('wallpaper-moved-region.png') })

  const width = region.getByRole('textbox').nth(2)
  await width.fill('0.32')
  await width.press('Enter')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share)
    .toBeLessThan(original.share * 0.75)
  await width.fill('0.64')
  await width.press('Enter')

  const amount = properties
    .getByRole('group', { name: 'Tear amount · 0–1', exact: true })
    .getByRole('textbox', { name: 'Value', exact: true })
  await amount.fill('0')
  await amount.press('Enter')
  await expect.poll(async () => (await exposedWall(page, canvas)).share).toBeLessThan(0.01)
  await amount.fill('1')
  await amount.press('Enter')
  await expect.poll(async () => (await exposedWall(page, canvas)).share).toBeGreaterThan(0.1)
  expect(await settledCompileCount(page)).toBe(compiles)

  const image = properties.getByRole('group', { name: 'Wallpaper image', exact: true })
  const wallBeforeUpload = await exposedWall(page, canvas)
  await image
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/red-swatch.png', import.meta.url)))
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()), { timeout: 15_000 })
    .toBeGreaterThan(1000)
  // Printing the wallpaper must not paint over the exposed wall or the paper backing.
  expect(Math.abs((await exposedWall(page, canvas)).share - wallBeforeUpload.share)).toBeLessThan(
    0.02,
  )

  await waitForAutosave(page)
  await page.reload()
  // The preview shape is session state; autosave restores the graph, not the camera/mesh.
  await preview.getByRole('radio', { name: 'Plane', exact: true }).click()
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(0.1)
  await expect(x).toHaveValue('0.3')
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()), { timeout: 15_000 })
    .toBeGreaterThan(1000)
  await image
    .getByRole('button', { name: 'Remove image from Wallpaper image', exact: true })
    .click()
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()), { timeout: 15_000 })
    .toBeLessThan(10)
  const openingBeforeUpload = await exposedWall(page, canvas)
  await innerWall
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/red-swatch.png', import.meta.url)))
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()), { timeout: 15_000 })
    .toBeGreaterThan(1000)
  await expect.poll(async () => (await exposedWall(page, canvas)).share).toBeLessThan(0.01)
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Missing preview canvas')
  // Only the former opening turns red; neither the outer wallpaper nor backing is repainted.
  const redShare =
    (await countReddishPixels(page, await canvas.screenshot())) / (bounds.width * bounds.height)
  expect(Math.abs(redShare - openingBeforeUpload.share)).toBeLessThan(0.03)
  await waitForAutosave(page)
  await page.reload()
  await preview.getByRole('radio', { name: 'Plane', exact: true }).click()
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()), { timeout: 15_000 })
    .toBeGreaterThan(1000)
  await expect(innerWall.locator('[data-texture-state]')).toHaveAttribute(
    'data-texture-state',
    'ready',
  )
  await innerWall
    .getByRole('button', { name: 'Remove image from Inner wall image', exact: true })
    .click()
  await expect
    .poll(async () => countReddishPixels(page, await canvas.screenshot()), { timeout: 15_000 })
    .toBeLessThan(10)
  await expect(preview.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
  expect(imageRequests.length).toBeGreaterThan(0)
  expect(
    imageRequests.every((url) =>
      /\/(botanical-sage-wallpaper|light-concrete-wall|tear-shape-sdf)\.png$/.test(
        new URL(url).pathname,
      ),
    ),
  ).toBe(true)
})

test('an uploaded SDF defines the tear, including interior holes, without repeating', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /shader|webgl|webgpu|tsl/i.test(message.text()))
      errors.push(message.text())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('option', { name: /^Torn wallpaper/ }).click()
  await page.getByRole('button', { name: 'Open template', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Main preview' })
  const canvas = preview.locator('canvas')
  const properties = page.getByRole('region', { name: 'Properties', exact: true })
  const shape = properties.getByRole('group', { name: 'Tear shape · SDF image', exact: true })
  const innerWall = properties.getByRole('group', { name: 'Inner wall image', exact: true })
  const value = (name: string) =>
    properties
      .getByRole('group', { name, exact: true })
      .getByRole('textbox', { name: 'Value', exact: true })
  const setValue = async (name: string, next: string) => {
    await value(name).fill(next)
    await value(name).press('Enter')
  }
  await expect(shape.locator('[data-texture-state]')).toHaveAttribute('data-texture-state', 'ready')
  await setValue('Edge roughness', '0')
  await setValue('Edge lift · 0–1', '0')
  await innerWall
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/transparent-swatch.png', import.meta.url)))
  await shape
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/tear-ring-sdf.png', import.meta.url)))
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(0.15)
  const original = await exposedWall(page, canvas)
  expect(original.share).toBeLessThan(0.23)
  const center = { left: 0.46, top: 0.46, right: 0.54, bottom: 0.54 }
  const ring = { left: 0.69, top: 0.48, right: 0.71, bottom: 0.52 }
  // The uploaded ring has an intact wallpaper island at its center and exposed wall around it.
  expect((await exposedWall(page, canvas, center)).share).toBeLessThan(0.01)
  expect((await exposedWall(page, canvas, ring)).share).toBeGreaterThan(0.9)
  const compiles = await firstSettledCompileCount(page)
  await setValue('SDF boundary · 0–1', '0.6')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share)
    .toBeLessThan(original.share * 0.8)
  await setValue('SDF boundary · 0–1', '0.5')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share)
    .toBeGreaterThan(original.share * 0.95)
  const region = properties.getByRole('group', {
    name: 'Tear region · XY center / ZW size',
    exact: true,
  })
  const x = region.getByRole('textbox').nth(0)
  await x.fill('0.8')
  await x.press('Enter')
  await expect.poll(async () => (await exposedWall(page, canvas)).x).toBeGreaterThan(0.67)
  expect(
    (await exposedWall(page, canvas, { left: 0, top: 0, right: 0.35, bottom: 1 })).share,
  ).toBeLessThan(0.01)
  await x.fill('0.5')
  await x.press('Enter')
  const width = region.getByRole('textbox').nth(2)
  await width.fill('0')
  await width.press('Enter')
  await expect.poll(async () => (await exposedWall(page, canvas)).share).toBeLessThan(0.01)
  await width.fill('-0.64')
  await width.press('Enter')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share)
    .toBeGreaterThan(original.share * 0.95)
  expect(await settledCompileCount(page)).toBe(compiles)
  await waitForAutosave(page)
  await page.reload()
  await preview.getByRole('radio', { name: 'Plane', exact: true }).click()
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(0.15)
  expect((await exposedWall(page, canvas, center)).share).toBeLessThan(0.01)
  await expect(shape.locator('[data-texture-state]')).toHaveAttribute('data-texture-state', 'ready')
  // A narrow 8px SDF must not let noise or peel spill across saturated texels.
  await shape
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/tear-ring-narrow-sdf.png', import.meta.url)))
  await setValue('SDF range · texture UV units', String(8 / 512))
  await setValue('Edge roughness', '0.055')
  await setValue('Edge lift · 0–1', '0.6')
  await expect
    .poll(async () => Math.abs((await exposedWall(page, canvas)).share - original.share))
    .toBeLessThan(0.02)
  expect((await exposedWall(page, canvas, center)).share).toBeLessThan(0.01)
  await innerWall
    .locator('input[type="file"]')
    .setInputFiles(
      fileURLToPath(new URL('../src/examples/textures/light-concrete-wall.png', import.meta.url)),
    )
  await expect(innerWall.locator('[data-texture-state]')).toHaveAttribute(
    'data-texture-state',
    'ready',
  )
  await expect.poll(async () => (await exposedWall(page, canvas)).share).toBeLessThan(0.05)
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.getByRole('radio', { name: 'Full', exact: true }).click()
  await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThan(700)
  await canvas.screenshot({ path: test.info().outputPath('wallpaper-sdf-ring.png') })
  await expect(preview.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the three framed shape sources swap through one shared input', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /shader|webgl|webgpu|tsl/i.test(message.text()))
      errors.push(message.text())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Templates', exact: true }).click()
  await page.getByRole('option', { name: /^Torn wallpaper/ }).click()
  await page.getByRole('button', { name: 'Open template', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Main preview' })
  const canvas = preview.locator('canvas')
  const properties = page.getByRole('region', { name: 'Properties', exact: true })
  const setValue = async (name: string, next: string) => {
    const field = properties
      .getByRole('group', { name, exact: true })
      .getByRole('textbox', { name: 'Value', exact: true })
    await field.fill(next)
    await field.press('Enter')
  }
  await properties
    .getByRole('group', { name: 'Inner wall image', exact: true })
    .locator('input[type="file"]')
    .setInputFiles(fileURLToPath(new URL('./fixtures/transparent-swatch.png', import.meta.url)))
  await setValue('Edge roughness', '0')
  await setValue('Edge lift · 0–1', '0')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(0.15)
  await waitForAutosave(page)
  // The connect menu numbers identical titles in document order. Use the saved document to
  // identify each source, then make the connection through the same keyboard UI as the user.
  const combineIds = (await readStoredNodes(page))
    .filter((node) => node.type === 'vector/combine')
    .map((node) => node.id)
  const connectShape = async (source: string) => {
    await page
      .locator('.react-flow__node[data-id="shapeInput"]')
      .getByRole('button', { name: /^In, input port/ })
      .press('Enter')
    const menu = page.getByRole('dialog', { name: 'Connect Split › In', exact: true })
    await expect(menu).toBeVisible()
    await page.keyboard.type(`Combine (${String(combineIds.indexOf(source) + 1)}) › Vec3`)
    await expect(menu.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(menu).toBeHidden()
    await waitForAutosave(page)
  }
  await connectShape('ellipseOutput')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(0.2)
  const ellipse = await exposedWall(page, canvas)
  // Analytic shapes must not inherit the texture SDF's encoded range or threshold.
  await setValue('SDF range · texture UV units', '0.0001')
  await setValue('SDF boundary · 0–1', '0.99')
  expect(Math.abs((await exposedWall(page, canvas)).share - ellipse.share)).toBeLessThan(0.005)
  await connectShape('boxOutput')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(ellipse.share + 0.03)
  const box = await exposedWall(page, canvas)
  const compiles = await firstSettledCompileCount(page)
  await setValue('Box corner radius · fraction of size', '0.5')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share)
    .toBeLessThan(box.share - 0.02)
  expect(await settledCompileCount(page)).toBe(compiles)
  await canvas.screenshot({ path: test.info().outputPath('rounded-box-source.png') })
  await setValue('SDF range · texture UV units', '0.5')
  await setValue('SDF boundary · 0–1', '0.5')
  await connectShape('textureOutput')
  await expect
    .poll(async () => (await exposedWall(page, canvas)).share, { timeout: 15_000 })
    .toBeGreaterThan(0.15)
  await expect(preview.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
})
