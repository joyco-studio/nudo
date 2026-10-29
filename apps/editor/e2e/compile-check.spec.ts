import { expect, test, type Locator, type Page } from '@playwright/test'

import { catalogDocument, masterLightingOptions } from './support/catalog-document'
import { centerColor, colorDistance } from './support/center-color'
import type { Rgb } from './support/center-color'
import {
  pickExampleByKeyboard,
  selectTemplateByKeyboard,
  templatesBrowser,
  templatesButton,
  templateTitles,
} from './support/open-example'
import { settledCompileCount } from './support/pending-work'
import { graphDocumentV2, seedAutosave } from './support/seed-graph'

/**
 * Guards that the GPU accepts what the editor builds. The runtime tests build TSL nodes but never
 * run a renderer, and some mistakes (a derivative in a vertex stage, say) only surface when the
 * renderer builds the shader. The preview already rejects such a material and says so.
 */

/** Software WebGL builds the whole catalog graph slowly; the default 5 s assertion is too tight. */
const COMPILE_TIMEOUT_MS = 60_000
/** The negative control's reason mentions the derivative that cannot run in a vertex stage. */
const DERIVATIVE_NAME = 'dFdx'

function mainPreview(page: Page): Locator {
  return page.getByRole('region', { name: 'Main preview' })
}

/** The status line under the preview: it holds the rejection, if the newest material has one. */
function rejectionNotice(page: Page): Locator {
  return mainPreview(page).getByText('did not compile')
}

/**
 * Normal From Height feeds both a vertex slot (position) and a fragment slot (baseColor). The
 * fragment stage can take its derivatives, the vertex stage cannot.
 */
const DERIVATIVE_IN_VERTEX_STAGE = graphDocumentV2(
  [{ id: 'bumps', type: 'normal/normal-from-height', position: { x: 200, y: 40 } }],
  [
    { id: 'bumps-to-position', from: ['bumps', 'out'], to: ['master', 'position'] },
    { id: 'bumps-to-base-color', from: ['bumps', 'out'], to: ['master', 'baseColor'] },
  ],
  [],
)

/**
 * The preview draws a material only once the renderer accepted it, and nothing says so but the
 * missing notice. A material still waiting in the validation queue shows no notice yet, so the
 * mesh itself is the proof: the middle of the frame stops matching its background.
 */
const MESH_VISIBLE_DISTANCE = 6
/** The corner of the frame, where only the background is: a fifth of each side. */
const CORNER_SHARE = 0.2

async function backgroundColor(page: Page, screenshot: Buffer): Promise<Rgb> {
  const [red, green, blue] = await page.evaluate(
    async ([base64, share]) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const side = Math.max(1, Math.floor(Math.min(bitmap.width, bitmap.height) * share))
      const surface = document.createElement('canvas')
      surface.width = side
      surface.height = side
      const context = surface.getContext('2d')
      if (context === null) throw new Error('2D canvas unavailable')
      context.drawImage(bitmap, 0, 0, side, side, 0, 0, side, side)
      const { data } = context.getImageData(0, 0, side, side)
      const sums = [0, 0, 0]
      for (let index = 0; index < data.length; index += 4) {
        sums[0] = (sums[0] ?? 0) + (data[index] ?? 0)
        sums[1] = (sums[1] ?? 0) + (data[index + 1] ?? 0)
        sums[2] = (sums[2] ?? 0) + (data[index + 2] ?? 0)
      }
      const pixels = data.length / 4
      return sums.map((sum) => sum / pixels)
    },
    [screenshot.toString('base64'), CORNER_SHARE] as const,
  )
  return [red ?? 0, green ?? 0, blue ?? 0]
}

async function meshContrast(page: Page): Promise<number> {
  const screenshot = await mainPreview(page).locator('canvas').screenshot()
  return colorDistance(await centerColor(page, screenshot), await backgroundColor(page, screenshot))
}

/**
 * Waits until the newest material is on screen, then expects no rejection. Neither failure notice
 * may show: `preview.rejected` ("did not compile") or `preview.compileFailed`.
 */
async function expectCompiled(page: Page): Promise<void> {
  await settledCompileCount(page)
  await expect
    .poll(
      async () =>
        (await rejectionNotice(page).count()) > 0 ||
        (await meshContrast(page)) > MESH_VISIBLE_DISTANCE,
      { timeout: COMPILE_TIMEOUT_MS },
    )
    .toBe(true)
  await expect(rejectionNotice(page)).toHaveCount(0)
  await expect(mainPreview(page).getByText('failed to compile')).toHaveCount(0)
}

test.describe('real renderer compile check', () => {
  test('every example compiles in a real renderer', async ({ page }) => {
    test.setTimeout(COMPILE_TIMEOUT_MS * 4)
    await page.goto('/')
    await templatesButton(page).click()
    await expect(templatesBrowser(page)).toBeVisible()
    const titles = await templateTitles(page)
    expect(titles.length).toBeGreaterThan(0)

    // The browser is open on an empty graph: the first template opens at once, every later one
    // replaces a graph with work in it and asks first.
    const [first, ...rest] = titles
    await selectTemplateByKeyboard(page, first ?? '')
    await page.keyboard.press('Enter')
    await expectCompiled(page)

    for (const title of rest) {
      await pickExampleByKeyboard(page, title)
      await page.getByRole('alertdialog').getByRole('button', { name: 'Open template' }).click()
      await expectCompiled(page)
    }
  })

  for (const lighting of masterLightingOptions()) {
    test(`the catalog graph compiles under ${lighting} lighting`, async ({ page }) => {
      test.setTimeout(COMPILE_TIMEOUT_MS * 2)
      await seedAutosave(page, catalogDocument(lighting))
      await page.goto('/')
      await expectCompiled(page)
    })
  }

  test('a known-bad graph is caught', async ({ page }) => {
    await seedAutosave(page, DERIVATIVE_IN_VERTEX_STAGE)
    await page.goto('/')
    await settledCompileCount(page)

    const notice = rejectionNotice(page)
    await expect(notice).toBeVisible({ timeout: COMPILE_TIMEOUT_MS })
    await expect(notice).toContainText(DERIVATIVE_NAME)
  })
})
