import { expect, test, type Locator, type Page } from '@playwright/test'

import { centerColor } from './support/center-color'
import type { Rgb } from './support/center-color'
import { graphDocument, seedAutosave } from './support/seed-graph'

/** A polished metal sphere: it shows its surroundings, so the environment decides its look. */
const METAL_SPHERE = graphDocument([], [])
const METAL_MASTER_VALUES = {
  metalness: { type: 'float', value: 1 },
  roughness: { type: 'float', value: 0.25 },
  baseColor: { type: 'vec3', value: [0.9, 0.6, 0.3] },
}
/** A clearly different picture: the mean color of the middle moves by more than this. */
const MIN_COLOR_DISTANCE = 12
/** A shader compile in software WebGL can take a while. */
const PREVIEW_TIMEOUT_MS = 60_000

function preview(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' })
}

/** The seeded graph, with the master's metal values filled in. */
function metalSphere(): string {
  const parsed: unknown = JSON.parse(METAL_SPHERE)
  if (typeof parsed !== 'object' || parsed === null || !('nodes' in parsed)) return METAL_SPHERE
  const { nodes } = parsed
  if (typeof nodes !== 'object' || nodes === null || !('master' in nodes)) return METAL_SPHERE
  const { master } = nodes
  if (typeof master === 'object' && master !== null) {
    Object.assign(master, { inputValues: METAL_MASTER_VALUES })
  }
  return JSON.stringify(parsed)
}

/** The folded Look row: its button says the current look and opens its fields. */
function lookToggle(page: Page): Locator {
  return preview(page).getByRole('button', { name: /^Look/ })
}

async function openLook(page: Page): Promise<void> {
  const toggle = lookToggle(page)
  if ((await toggle.getAttribute('aria-expanded')) === 'true') return
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

const distance = (a: Rgb, b: Rgb): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

async function middleColor(page: Page): Promise<Rgb> {
  return centerColor(page, await preview(page).locator('canvas').screenshot())
}

/** Waits until the middle of the preview settles on a color other than `before`. */
async function expectPictureChange(page: Page, before: Rgb): Promise<void> {
  await expect
    .poll(async () => distance(before, await middleColor(page)), { timeout: PREVIEW_TIMEOUT_MS })
    .toBeGreaterThan(MIN_COLOR_DISTANCE)
}

async function openOnMetal(page: Page): Promise<Rgb> {
  await seedAutosave(page, metalSphere())
  await page.goto('/')
  await expect(preview(page).getByText(/^(WebGPU|WebGL2)$/)).toBeVisible()
  // The material compiles after the first frame: wait for the sphere to stop changing.
  let previous = await middleColor(page)
  await expect
    .poll(
      async () => {
        const current = await middleColor(page)
        const settled = distance(previous, current) < 1
        previous = current
        return settled && current[0] > 20
      },
      { timeout: PREVIEW_TIMEOUT_MS, intervals: [500] },
    )
    .toBe(true)
  return previous
}

test.describe('preview look', () => {
  test('starts on ACES with the studio environment and a 1× exposure', async ({ page }) => {
    await openOnMetal(page)
    // Folded, the row says the look; the fields stay out of the tab order until it opens.
    await expect(lookToggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(lookToggle(page)).toContainText('ACES · Studio')
    await expect(preview(page).getByRole('combobox', { name: 'Tone mapping' })).toBeHidden()
    await openLook(page)

    await expect(preview(page).getByRole('combobox', { name: 'Tone mapping' })).toHaveText('ACES')
    await expect(preview(page).getByRole('combobox', { name: 'Environment' })).toHaveText('Studio')
    await expect(preview(page).getByRole('slider', { name: 'Exposure' })).toHaveAttribute(
      'aria-valuetext',
      '1.00×',
    )
  })

  test('the environment changes how a metal sphere looks, and the choice persists', async ({
    page,
  }) => {
    test.setTimeout(PREVIEW_TIMEOUT_MS * 3)
    const studio = await openOnMetal(page)
    await openLook(page)
    const environment = preview(page).getByRole('combobox', { name: 'Environment' })

    await environment.focus()
    // Type-ahead on the closed select picks the option that starts with the letter.
    await page.keyboard.press('n')
    await expect(environment).toHaveText('Neutral')
    await expectPictureChange(page, studio)

    await page.reload()
    await expect(lookToggle(page)).toContainText('Neutral')
    await openLook(page)
    await expect(preview(page).getByRole('combobox', { name: 'Environment' })).toHaveText('Neutral')
  })

  test('tone mapping and exposure change the picture, from the keyboard alone', async ({
    page,
  }) => {
    test.setTimeout(PREVIEW_TIMEOUT_MS * 3)
    const aces = await openOnMetal(page)
    await openLook(page)
    const toneMapping = preview(page).getByRole('combobox', { name: 'Tone mapping' })

    await toneMapping.focus()
    await page.keyboard.press('n')
    await expect(toneMapping).toHaveText('Neutral')
    await expectPictureChange(page, aces)

    const before = await middleColor(page)
    const exposure = preview(page).getByRole('slider', { name: 'Exposure' })
    await exposure.focus()
    await page.keyboard.press('End')
    await expect(exposure).toHaveAttribute('aria-valuetext', '3.00×')
    await expectPictureChange(page, before)
  })
})
