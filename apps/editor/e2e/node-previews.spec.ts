import { expect, test, type Locator, type Page } from '@playwright/test'

import { BLOB_TUTORIAL_GRAPH } from './support/blob-tutorial-graph'
import { expectFocusRing, tabUntilFocused } from './support/focus-indicators'
import { readStoredNodes } from './support/read-autosave'
import { graphDocument, seedAutosave, seedAutosaveOnce } from './support/seed-graph'

/** A pure green Color node, on its own. */
const GREEN_COLOR = graphDocument(
  [
    {
      id: 'color',
      type: 'input/color',
      position: { x: 100, y: 40 },
      inputValues: { color: { type: 'vec3', value: [0, 1, 0] } },
    },
  ],
  [],
)

/** Time feeding Fract: a sawtooth from 0 to 1 every second, so its preview never stands still. */
const TIME_TO_FRACT = graphDocument(
  [
    { id: 'time', type: 'input/time', position: { x: 0, y: 40 } },
    { id: 'fract', type: 'math/fract', position: { x: 300, y: 40 } },
  ],
  [{ id: 'time-to-fract', from: ['time', 'out'], to: ['fract', 'in'] }],
)

/** How long the frame-budget test watches the tutorial graph animate. */
const MEASURE_MS = 3000
/** Previews of the tutorial graph that fit in the default 1280×720 viewport, at least. */
const MIN_ON_SCREEN_PREVIEWS = 6
const PREVIEW_FPS_CAP = 20

/** Longer than one second, after which raw Time seconds would read as solid white. */
const SATURATION_WAIT_MS = 1500
const WHITE_CHANNEL = 250

/** Long enough to cover a few 20 fps frames, short enough to land inside one sawtooth tooth. */
const ANIMATION_SAMPLE_GAP_MS = 250

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('main', { name: 'Node canvas' }).getByRole('group', { name, exact: true })
}

function nodePreview(page: Page, title: string): Locator {
  return page.getByRole('img', { name: `${title} preview`, exact: true })
}

/** A pixel of a node preview canvas, at a fraction of its width and height, from its 2D context. */
async function pixelAt(preview: Locator, fractionX: number, fractionY: number): Promise<Rgba> {
  return preview.evaluate(
    (element, [x, y]) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas')
      const context = element.getContext('2d')
      if (context === null) throw new Error('No 2D context')
      const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(
        Math.floor((element.width - 1) * x),
        Math.floor((element.height - 1) * y),
        1,
        1,
      ).data
      return { r, g, b, a }
    },
    [fractionX, fractionY] as const,
  )
}

const centerPixel = (preview: Locator): Promise<Rgba> => pixelAt(preview, 0.5, 0.5)

/** The `data-preview-status` of every preview frame on the canvas. */
async function previewStatuses(page: Page): Promise<(string | null)[]> {
  return page
    .locator('[data-preview-status]')
    .evaluateAll((frames) => frames.map((frame) => frame.getAttribute('data-preview-status')))
}

/** A preview whose picture changes between two samples a few frames apart. */
async function expectAnimates(page: Page, preview: Locator): Promise<void> {
  await expect(preview).toBeVisible()
  await expect.poll(async () => (await centerPixel(preview)).a).toBe(255)
  const first = await centerPixel(preview)
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(ANIMATION_SAMPLE_GAP_MS)
        return (await centerPixel(preview)).r
      },
      { timeout: 5000 },
    )
    .not.toBe(first.r)
}

async function storedShowPreview(page: Page, nodeId: string): Promise<unknown> {
  const node = (await readStoredNodes(page)).find((stored) => stored.id === nodeId)
  return node?.params.showPreview
}

test.describe('node previews', () => {
  test('color node preview shows its color', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await seedAutosave(page, GREEN_COLOR)
    await page.goto('/')

    const preview = nodePreview(page, 'Color')
    await expect(preview).toBeVisible()
    await expect.poll(() => centerPixel(preview)).toMatchObject({ r: 0, g: 255, b: 0, a: 255 })
    // The master's preview is the Main Preview: the node itself shows none.
    await expect(graphNode(page, 'Master Stack').getByRole('img')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  test('time node preview animates while visible', async ({ page }) => {
    await seedAutosave(page, TIME_TO_FRACT)
    await page.goto('/')

    const preview = nodePreview(page, 'Fract')
    await expectAnimates(page, preview)
    // Fract is grey: every channel carries the same value.
    const later = await centerPixel(preview)
    expect(later.g).toBe(later.r)
  })

  test("the time node's own preview loops instead of saturating to white", async ({ page }) => {
    await seedAutosave(page, TIME_TO_FRACT)
    await page.goto('/')

    const preview = nodePreview(page, 'Time')
    await expectAnimates(page, preview)
    // Well past one second, raw seconds would be white for good; the looped value keeps dipping.
    await page.waitForTimeout(SATURATION_WAIT_MS)
    await expect
      .poll(
        async () => {
          await page.waitForTimeout(ANIMATION_SAMPLE_GAP_MS)
          return (await centerPixel(preview)).r
        },
        { timeout: 5000 },
      )
      .toBeLessThan(WHITE_CHANNEL)
  })

  test('toggle hides preview', async ({ page }) => {
    await seedAutosaveOnce(page, GREEN_COLOR)
    await page.goto('/')
    const color = graphNode(page, 'Color')
    const toggle = color.getByRole('button', { name: 'Preview', exact: true })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(nodePreview(page, 'Color')).toBeVisible()

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(nodePreview(page, 'Color')).toHaveCount(0)
    await expect.poll(() => storedShowPreview(page, 'color')).toBe(false)

    // Saved with the graph: a reload keeps it hidden.
    await page.reload()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(nodePreview(page, 'Color')).toHaveCount(0)

    // The Inspector switch is the same setting, and it shows the preview again.
    await color.locator('header').click()
    const inspector = page.getByRole('region', { name: 'Inspector' })
    const show = inspector.getByRole('group', { name: 'Preview' }).getByRole('switch', {
      name: 'Show',
    })
    await expect(show).not.toBeChecked()
    await show.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(nodePreview(page, 'Color')).toBeVisible()

    // From the keyboard: Tab from the node reaches the toggle, shows the ring, Enter flips it.
    await color.focus()
    await tabUntilFocused(page, toggle)
    await expectFocusRing(page, toggle)
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(show).not.toBeChecked()
  })

  test('3D mode draws the preview as a circle', async ({ page }) => {
    await seedAutosave(page, GREEN_COLOR)
    await page.goto('/')
    const color = graphNode(page, 'Color')
    await color.locator('header').click()
    const inspector = page.getByRole('region', { name: 'Inspector' })
    await inspector.getByRole('combobox', { name: 'Mode' }).click()
    await page.getByRole('option', { name: '3D' }).click()

    const frame = color.locator('[data-preview-shape]')
    await expect(frame).toHaveAttribute('data-preview-shape', '3d')
    await expect(frame).not.toHaveCSS('border-top-left-radius', '0px')
    // The sphere fills the middle; the corners, outside the round mask, are left transparent.
    const preview = nodePreview(page, 'Color')
    await expect.poll(() => centerPixel(preview)).toMatchObject({ g: 255, a: 255 })
    expect((await pixelAt(preview, 0, 0)).a).toBe(0)
    expect((await pixelAt(preview, 1, 1)).a).toBe(0)
  })

  test('tutorial-size graph keeps animated previews under the frame budget', async ({ page }) => {
    await seedAutosave(page, BLOB_TUTORIAL_GRAPH)
    await page.goto('/')
    await expect(nodePreview(page, 'Remap')).toBeVisible()
    // Off-screen previews stay pending (never built or drawn); the on-screen ones get drawn.
    await expect
      .poll(async () => (await previewStatuses(page)).filter((status) => status === 'ready').length)
      .toBeGreaterThanOrEqual(MIN_ON_SCREEN_PREVIEWS)
    const statuses = await previewStatuses(page)
    const drawn = statuses.filter((status) => status === 'ready').length
    expect(statuses.filter((status) => status === 'error' || status === 'unavailable')).toEqual([])

    await page.evaluate(() => {
      delete window.__nudoNodePreviewStats
    })
    const frames = await page.evaluate(async (durationMs) => {
      const gaps: number[] = []
      let last = performance.now()
      const end = last + durationMs
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          gaps.push(now - last)
          last = now
          if (now < end) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })
      return { count: gaps.length, longest: Math.max(...gaps) }
    }, MEASURE_MS)
    const stats = await page.evaluate(() => window.__nudoNodePreviewStats)
    if (stats === undefined) throw new Error('No preview renders were recorded')

    const seconds = MEASURE_MS / 1000
    const rendersPerSecond = stats.renders / seconds
    // Only drawn (on-screen) previews render, and none faster than the cap.
    expect(rendersPerSecond).toBeLessThanOrEqual(drawn * PREVIEW_FPS_CAP)
    test.info().annotations.push({
      type: 'preview frame cost',
      description: JSON.stringify({
        previews: statuses.length,
        onScreen: drawn,
        rendersPerSecond: Math.round(rendersPerSecond),
        averageRenderMs: Number((stats.renderMs / stats.renders).toFixed(3)),
        maxRenderMs: Number(stats.maxRenderMs.toFixed(3)),
        previewMsPerSecond: Number((stats.renderMs / seconds).toFixed(2)),
        displayFrames: frames.count,
        longestFrameMs: Number(frames.longest.toFixed(1)),
      }),
    })
  })

  test('preview controls speak Spanish', async ({ page }) => {
    await seedAutosave(page, GREEN_COLOR)
    await page.addInitScript(() => {
      localStorage.setItem('nudo-tsl:locale', 'es')
    })
    await page.goto('/')
    const color = page.getByRole('group', { name: 'Color', exact: true })
    await expect(color.getByRole('button', { name: 'Vista previa', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('img', { name: 'Vista previa de Color' })).toBeVisible()

    await color.locator('header').click()
    const section = page
      .getByRole('region', { name: 'Inspector' })
      .getByRole('group', { name: 'Vista previa' })
    await expect(section.getByRole('switch', { name: 'Mostrar' })).toBeChecked()
    await expect(section.getByRole('combobox', { name: 'Modo' })).toHaveText('Automático')
  })
})
