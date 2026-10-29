import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'

import { countGreenishPixels } from './support/count-tinted-pixels'
import { tabUntilFocused } from './support/focus-indicators'
import { changedShare } from './support/luminance-spread'
import { firstSettledCompileCount, settledCompileCount } from './support/pending-work'
import { readStoredNodes } from './support/read-autosave'
import { graphDocument, seedAutosave } from './support/seed-graph'
import type { SeedNode } from './support/seed-graph'

/** A closed mesh with normals, loaded as a file: Blender's monkey, as the preview bundles it. */
const SUZANNE_PATH = fileURLToPath(
  new URL('../src/features/main-preview/models/suzanne.glb', import.meta.url),
)
/** A ring of green around the sphere: well clear of the few stray pixels antialiasing could make. */
const MIN_OUTLINE_PIXELS = 150
/** With no outline drawn, nothing in an orange-on-grey frame is green. */
const MAX_STRAY_PIXELS = 10
/** Wide enough (in scene units) that the line is a few pixels thick in the docked preview. */
const SEEDED_WIDTH = 0.04
/** 40 px at 0.01 per pixel adds 0.4 to the width. */
const SCRUB_DISTANCE_PX = 40
const SCRUB_STEPS = 10
/** Most of the seeded width, so the line visibly swells and thins but never vanishes. */
const WOBBLE = '0.03'
/** Long enough for the wobble's noise to drift a visible step between two frames. */
const FRAME_GAP_MS = 400

/** An orange surface with a green outline, so its pixels stand apart from surface and background. */
function outlinedDocument(params: SeedNode['params'] = {}): string {
  const color: SeedNode = {
    id: 'color',
    type: 'input/color',
    position: { x: 200, y: 40 },
    inputValues: { color: { type: 'vec3', value: [1, 0.2, 0.05] } },
  }
  return graphDocument(
    [color],
    [{ id: 'color-to-base', from: ['color', 'out'], to: ['master', 'baseColor'] }],
    {
      params,
      inputValues: {
        outlineColor: { type: 'vec3', value: [0, 1, 0] },
        outlineWidth: { type: 'float', value: SEEDED_WIDTH },
      },
    },
  )
}

function preview(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' })
}

function master(page: Page): Locator {
  return page.getByRole('group', { name: 'Master Stack', exact: true })
}

async function outlinePixels(page: Page): Promise<number> {
  return countGreenishPixels(page, await preview(page).locator('canvas').screenshot())
}

async function previewApplyCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__nudoPreviewApplyCount ?? 0)
}

async function storedMaster(page: Page) {
  return (await readStoredNodes(page)).find((node) => node.id === 'master')
}

test.describe('outline', () => {
  test('the Outline switch draws a silhouette line, from the node and the Graph settings', async ({
    page,
  }) => {
    await seedAutosave(page, outlinedDocument())
    await page.goto('/')
    const compilesBefore = await firstSettledCompileCount(page)
    await expect(preview(page).getByText(/^(WebGPU|WebGL2)$/)).toBeVisible()
    await expect.poll(() => outlinePixels(page)).toBeLessThan(MAX_STRAY_PIXELS)

    // Graph settings edit the same switch the node shows.
    const settingsSwitch = page
      .getByRole('region', { name: 'Inspector' })
      .getByRole('switch', { name: 'Outline', exact: true })
    const nodeSwitch = master(page).getByRole('switch', { name: 'Outline', exact: true })
    await expect(settingsSwitch).toHaveAccessibleDescription(/drawing the mesh a second time/)
    await nodeSwitch.focus()
    await page.keyboard.press('Space')
    await expect(nodeSwitch).toBeChecked()
    await expect(settingsSwitch).toBeChecked()

    // Switching the outline is structural: it compiles once, and the line shows around the sphere.
    await expect.poll(() => outlinePixels(page)).toBeGreaterThan(MIN_OUTLINE_PIXELS)
    expect(await settledCompileCount(page)).toBeGreaterThan(compilesBefore)
    await expect
      .poll(async () => (await storedMaster(page))?.params)
      .toMatchObject({ outline: true })

    // The Outline group opened with the switch; its rows no longer ask for it.
    await expect(
      master(page).getByRole('button', { name: 'Outline', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(master(page).locator('li[data-port-id="outlineWidth"]')).not.toHaveAttribute(
      'data-disabled',
    )

    // Tab reaches the Graph settings switch; Space turns the outline off again.
    await tabUntilFocused(page, settingsSwitch)
    await page.keyboard.press('Space')
    await expect(nodeSwitch).not.toBeChecked()
    await expect.poll(() => outlinePixels(page)).toBeLessThan(MAX_STRAY_PIXELS)
    await expect(master(page).locator('li[data-port-id="outlineWidth"]')).toHaveCount(0)
  })

  test('scrubbing the width thickens the line live, without compiling', async ({ page }) => {
    await seedAutosave(page, outlinedDocument({ outline: true }))
    await page.goto('/')
    const compilesBefore = await firstSettledCompileCount(page)
    await expect.poll(() => outlinePixels(page)).toBeGreaterThan(MIN_OUTLINE_PIXELS)
    const thinPixels = await outlinePixels(page)
    const appliedBefore = await previewApplyCount(page)

    const label = master(page).locator('label', { hasText: 'Outline Width' })
    const box = await label.boundingBox()
    if (box === null) throw new Error('The Outline Width label has no bounding box')
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + SCRUB_DISTANCE_PX, startY, { steps: SCRUB_STEPS })

    await expect.poll(() => previewApplyCount(page)).toBeGreaterThan(appliedBefore)
    await expect.poll(() => outlinePixels(page)).toBeGreaterThan(thinPixels)
    await page.mouse.up()
    expect(await settledCompileCount(page)).toBe(compilesBefore)
  })

  test('a wobble makes the line swell and thin over time, live, and it stays visible', async ({
    page,
  }) => {
    await seedAutosave(page, outlinedDocument({ outline: true }))
    await page.goto('/')
    const compilesBefore = await firstSettledCompileCount(page)
    const canvas = preview(page).locator('canvas')
    await expect.poll(() => outlinePixels(page)).toBeGreaterThan(MIN_OUTLINE_PIXELS)

    // Without a wobble the line holds still.
    const still = await canvas.screenshot()
    await page.waitForTimeout(FRAME_GAP_MS)
    expect(await changedShare(page, still, await canvas.screenshot())).toBe(0)

    const wobble = master(page).getByRole('textbox', { name: 'Outline Wobble' })
    await wobble.fill(WOBBLE)
    await wobble.press('Enter')

    // With one, the silhouette moves from frame to frame, and the line is still there.
    await expect
      .poll(async () => {
        const before = await canvas.screenshot()
        await page.waitForTimeout(FRAME_GAP_MS)
        return changedShare(page, before, await canvas.screenshot())
      })
      .toBeGreaterThan(0)
    expect(await outlinePixels(page)).toBeGreaterThan(MIN_OUTLINE_PIXELS)
    expect(await settledCompileCount(page)).toBe(compilesBefore)
  })

  test('outlines Suzanne and a loaded model too', async ({ page }) => {
    await seedAutosave(page, outlinedDocument({ outline: true }))
    await page.goto('/')
    const picker = preview(page).getByRole('radiogroup', { name: 'Preview mesh' })
    await expect.poll(() => outlinePixels(page)).toBeGreaterThan(MIN_OUTLINE_PIXELS)

    await picker.getByRole('radio', { name: 'Suzanne' }).focus()
    await expect(picker.getByRole('radio', { name: 'Suzanne' })).toBeChecked()
    await expect.poll(() => outlinePixels(page)).toBeGreaterThan(MIN_OUTLINE_PIXELS)

    await preview(page).locator('input[type="file"]').setInputFiles(SUZANNE_PATH)
    await expect(picker.getByRole('radio', { name: 'Model' })).toBeChecked()
    await expect.poll(() => outlinePixels(page)).toBeGreaterThan(MIN_OUTLINE_PIXELS)
  })
})
