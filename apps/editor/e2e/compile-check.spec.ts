import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'

import { en } from '../src/i18n/messages/en'
import { catalogDocument, masterLightingOptions } from './support/catalog-document'
import { centerColor, colorDistance, cornerColor } from './support/center-color'
import { templatesBrowser, templatesButton } from './support/open-example'
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

/** The start of the `preview.rejected` message, before the reason: the notice is on screen. */
const REJECTED_PREFIX = en['preview.rejected'].split('{reason}')[0] ?? ''

/** The status line under the preview: it holds the rejection, if the newest material has one. */
function rejectionNotice(page: Page): Locator {
  return mainPreview(page).getByText(REJECTED_PREFIX)
}

function compileFailedNotice(page: Page): Locator {
  return mainPreview(page).getByText(en['preview.compileFailed'])
}

const EXAMPLES_DIRECTORY = join(import.meta.dirname, '../src/examples')
const GRAPH_FILE_SUFFIX = '.graph.json'

/** Every bundled example's stored document, by file name, so a new example is covered at once. */
function exampleDocuments(): readonly { readonly id: string; readonly document: string }[] {
  return readdirSync(EXAMPLES_DIRECTORY)
    .filter((file) => file.endsWith(GRAPH_FILE_SUFFIX))
    .map((file) => ({
      id: file.slice(0, -GRAPH_FILE_SUFFIX.length),
      document: readFileSync(join(EXAMPLES_DIRECTORY, file), 'utf8'),
    }))
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

async function meshContrast(page: Page): Promise<number> {
  const screenshot = await mainPreview(page).locator('canvas').screenshot()
  return colorDistance(await centerColor(page, screenshot), await cornerColor(page, screenshot))
}

/**
 * Waits until the newest material is on screen, then expects no rejection. Neither failure notice
 * may show: `preview.rejected` ("did not compile") or `preview.compileFailed`. It needs a page
 * whose first compile is the graph under test: later on, the preview keeps showing the last
 * accepted material until the renderer answers for the new one, so a mesh proves nothing.
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
  await expect(compileFailedNotice(page)).toHaveCount(0)
}

test.describe('real renderer compile check', () => {
  const examples = exampleDocuments()

  test('the templates browser lists every example file', async ({ page }) => {
    expect(examples.length).toBeGreaterThan(0)
    await page.goto('/')
    await templatesButton(page).click()
    await expect(templatesBrowser(page).getByRole('option')).toHaveCount(examples.length)
  })

  // Each example loads on a page of its own, as the first graph it compiles (see `expectCompiled`).
  for (const { id, document } of examples) {
    test(`the ${id} example compiles in a real renderer`, async ({ page }) => {
      test.setTimeout(COMPILE_TIMEOUT_MS * 2)
      await seedAutosave(page, document)
      await page.goto('/')
      await expectCompiled(page)
    })
  }

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
