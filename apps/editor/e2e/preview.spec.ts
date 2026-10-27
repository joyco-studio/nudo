import { expect, test, type Locator, type Page } from '@playwright/test'

import { readStoredNodes } from './support/read-autosave'
import { COLOR_TO_BASE_COLOR, seedAutosave } from './support/seed-graph'

const FALLBACK_MESSAGE =
  'Preview unavailable. Open the editor in a current Chrome, Edge or Safari to see the material.'
/** Longer than the compile debounce (150 ms), so a pending rebuild would have fired by then. */
const PAST_DEBOUNCE_MS = 500
/** The seeded Color node is orange: a lit sphere shows pixels that are clearly redder than blue. */
const REDDISH_MARGIN = 60
const MIN_REDDISH_PIXELS = 200
/** 40 px at 0.01 per pixel moves Roughness from its default 0.5 to 0.9. */
const SCRUB_DISTANCE_PX = 40
const SCRUB_STEPS = 10
const SCRUBBED_ROUGHNESS = '0.9'

function preview(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' })
}

function meshPicker(page: Page): Locator {
  return preview(page).getByRole('radiogroup', { name: 'Preview mesh' })
}

async function compileCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoCompileCount ?? 0)
}

async function previewApplyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoPreviewApplyCount ?? 0)
}

async function storedMasterRoughness(page: Page): Promise<unknown> {
  const master = (await readStoredNodes(page)).find((node) => node.id === 'master')
  return master?.inputValues.roughness
}

/** Counts pixels of a PNG screenshot whose red channel clearly dominates the blue one. */
async function countReddishPixels(page: Page, screenshot: Buffer): Promise<number> {
  return page.evaluate(
    async ([base64, margin]) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const surface = document.createElement('canvas')
      surface.width = bitmap.width
      surface.height = bitmap.height
      const context = surface.getContext('2d')
      if (context === null) throw new Error('2D canvas unavailable')
      context.drawImage(bitmap, 0, 0)
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      let reddish = 0
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index] ?? 0
        const blue = data[index + 2] ?? 0
        if (red > blue + margin) reddish += 1
      }
      return reddish
    },
    [screenshot.toString('base64'), REDDISH_MARGIN] as const,
  )
}

test.describe('main preview', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
  })

  test('preview canvas renders and shows backend badge', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto('/')

    const canvas = preview(page).locator('canvas')
    await expect(canvas).toBeVisible()
    await expect(preview(page).getByText(/^(WebGPU|WebGL2)$/)).toBeVisible()

    // The compiled orange material is actually drawn, not just an empty canvas.
    await expect
      .poll(async () => countReddishPixels(page, await canvas.screenshot()))
      .toBeGreaterThan(MIN_REDDISH_PIXELS)
    expect(pageErrors).toEqual([])
  })

  test('changing color value does not log compile', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    const before = await compileCount(page)

    const swatch = page
      .getByRole('group', { name: 'Color', exact: true })
      .getByRole('button', { name: 'Color', exact: true })
    await swatch.click()
    const hex = page.getByRole('dialog', { name: 'Color' }).getByRole('textbox', { name: 'Hex' })
    await hex.fill('#00ff00')
    await hex.press('Enter')
    await expect
      .poll(async () => {
        const color = (await readStoredNodes(page)).find((node) => node.id === 'color')
        return color?.inputValues.color
      })
      .toEqual({ type: 'vec3', value: [0, 1, 0] })
    await page.waitForTimeout(PAST_DEBOUNCE_MS)

    expect(await compileCount(page)).toBe(before)
  })

  test('scrubbing a number field updates the preview live without compiling', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => compileCount(page)).toBeGreaterThan(0)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    const compilesBefore = await compileCount(page)
    const appliedBefore = await previewApplyCount(page)

    const master = page.getByRole('group', { name: 'Master Stack', exact: true })
    const label = master.locator('label', { hasText: 'Roughness' })
    const field = master.getByRole('textbox', { name: 'Roughness' })
    const box = await label.boundingBox()
    if (box === null) throw new Error('Roughness label has no bounding box')
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + SCRUB_DISTANCE_PX, startY, { steps: SCRUB_STEPS })

    // Mid-scrub: the field and the material move, but the graph (and its history) has not.
    await expect(field).toHaveValue(SCRUBBED_ROUGHNESS)
    await expect.poll(() => previewApplyCount(page)).toBeGreaterThan(appliedBefore)
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    expect(await storedMasterRoughness(page)).toBeUndefined()
    expect(await compileCount(page)).toBe(compilesBefore)

    await page.mouse.up()
    await expect
      .poll(() => storedMasterRoughness(page))
      .toEqual({ type: 'float', value: Number(SCRUBBED_ROUGHNESS) })
    await page.waitForTimeout(PAST_DEBOUNCE_MS)
    expect(await compileCount(page)).toBe(compilesBefore)

    // One scrub is one undo step. Releasing on the label focuses its field, which owns undo.
    await field.blur()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(field).toHaveValue('0.5')
  })

  test('switching mesh by keyboard', async ({ page }) => {
    await page.goto('/')
    const picker = meshPicker(page)
    const sphere = picker.getByRole('radio', { name: 'Sphere' })
    const cube = picker.getByRole('radio', { name: 'Cube' })
    const plane = picker.getByRole('radio', { name: 'Plane' })
    await expect(sphere).toBeChecked()

    await sphere.focus()
    await page.keyboard.press('ArrowRight')
    await expect(cube).toBeFocused()
    await expect(cube).toBeChecked()
    await expect(sphere).not.toBeChecked()

    await page.keyboard.press('ArrowRight')
    await expect(plane).toBeChecked()
    await page.keyboard.press('ArrowLeft')
    await expect(cube).toBeChecked()
  })

  test('reset view and background color are keyboard operable', async ({ page }) => {
    await page.goto('/')
    const resetView = preview(page).getByRole('button', { name: 'Reset view' })
    await resetView.focus()
    await page.keyboard.press('Enter')
    await expect(resetView).toBeFocused()

    // While the picker is open (a modal dialog) the rest of the page is hidden from the a11y tree.
    const background = page
      .getByRole('region', { name: 'Main preview', includeHidden: true })
      .getByRole('button', { name: 'Background color', includeHidden: true })
    await expect(background).toHaveAccessibleDescription(/^#[0-9A-F]{6}$/)
    await background.focus()
    await page.keyboard.press('Enter')
    const hex = page
      .getByRole('dialog', { name: 'Background color' })
      .getByRole('textbox', { name: 'Hex' })
    await expect(page.getByRole('slider', { name: 'Saturation and brightness' })).toBeFocused()
    await hex.fill('#336699')
    // The preview takes the color while typing, before the picker closes.
    await expect(background).toHaveAccessibleDescription('#336699')
    await page.keyboard.press('Escape')
    await expect(background).not.toHaveAccessibleDescription('#336699')
    await expect(background).toBeFocused()

    await page.keyboard.press('Enter')
    await hex.fill('#336699')
    await hex.press('Enter')
    await expect(background).toHaveAccessibleDescription('#336699')
    await expect(background).toBeFocused()
  })

  test('loading a GLB model adds it to the mesh picker', async ({ page }) => {
    await page.goto('/')
    await preview(page)
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'triangle.gltf',
        mimeType: 'model/gltf+json',
        buffer: Buffer.from(TRIANGLE_GLTF),
      })

    await expect(meshPicker(page).getByRole('radio', { name: 'Model' })).toBeChecked()
  })
})

test.describe('without WebGPU or WebGL2', () => {
  test.beforeEach(async ({ page }) => {
    await seedAutosave(page, COLOR_TO_BASE_COLOR)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true })
      // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with the canvas as `this` below
      const originalGetContext = HTMLCanvasElement.prototype.getContext
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        writable: true,
        value(this: HTMLCanvasElement, contextId: string, ...rest: unknown[]): unknown {
          if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'webgpu') return null
          const context: unknown = Reflect.apply(originalGetContext, this, [contextId, ...rest])
          return context
        },
      })
    })
  })

  test('no WebGPU/WebGL2 shows fallback message while canvas editing still works', async ({
    page,
  }) => {
    await page.goto('/')

    // An alert, so assistive technology announces why the preview is missing.
    await expect(preview(page).getByRole('alert')).toHaveText(FALLBACK_MESSAGE)
    await expect(preview(page).locator('canvas')).toHaveCount(0)

    const color = page.getByRole('group', { name: 'Color', exact: true })
    await color.focus()
    await page.keyboard.press('Space')
    const dialog = page.getByRole('dialog', { name: 'Add node' })
    await expect(dialog).toBeVisible()
    await page.keyboard.type('fres')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('group', { name: 'Fresnel', exact: true })).toBeVisible()
  })
})

/** One triangle with an embedded buffer: the smallest valid glTF document. */
const TRIANGLE_GLTF = JSON.stringify({
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: 'VEC3',
      max: [1, 1, 0],
      min: [0, 0, 0],
    },
  ],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  buffers: [
    {
      byteLength: 36,
      uri: 'data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA',
    },
  ],
})
