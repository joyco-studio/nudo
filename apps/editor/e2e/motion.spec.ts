import { expect, test, type Locator, type Page } from '@playwright/test'

import { expectFocusRing, tabUntilFocused } from './support/focus-indicators'
import { traceAppearance, traceExit } from './support/motion-trace'
import type { MotionTrace } from './support/motion-trace'
import { COLOR_TO_BASE_COLOR, TIME_AND_SINE, seedAutosave } from './support/seed-graph'

const POPOVER = '[data-slot="popover-content"]'
const DIALOG = '[data-slot="dialog-content"]'
const ALERT_DIALOG = '[data-slot="alert-dialog-content"]'
const SELECT = '[data-slot="select-content"]'
const COMMAND_PALETTE = '[data-command-palette]'
const PALETTE_CHORD = 'ControlOrMeta+k'

/** The motion-token values the overlays use (ruling P2-R12). */
const MENU_OPEN_MS = 250
const MENU_CLOSE_MS = 150
const MENU_FROM_SCALE = 0.97
const DIALOG_FROM_SCALE = 0.96
const SCALE_DIGITS = 2
/** Inside the pane's left edge, clear of the nodes and of the picker. */
const OUTSIDE_INSET_PX = 8
/** Far enough out that a thumb animated in screen pixels would visibly jump. */
const ZOOM_OUT_STEPS = 3
/** At most this much of a 350ms travel can pass on its first frame. */
const FIRST_FRAME_SHARE = 0.3
/** Well inside a 150ms close or a 250ms open. */
const MID_ANIMATION_MS = 40

function graphNode(page: Page, name: string): Locator {
  return page.getByRole('group', { name, exact: true })
}

/** While the picker is open (a modal dialog) the rest of the page is hidden from the a11y tree. */
function colorSwatch(page: Page): Locator {
  return page
    .getByRole('group', { name: 'Color', exact: true, includeHidden: true })
    .getByRole('button', { name: 'Color', exact: true, includeHidden: true })
}

async function openCanvas(page: Page, document: string): Promise<void> {
  await seedAutosave(page, document)
  await page.goto('/')
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
}

function expectNeverAnimated(trace: MotionTrace): void {
  expect(trace.samples.length).toBeGreaterThan(0)
  for (const sample of trace.samples) {
    expect(sample.opacity).toBe(1)
    expect(sample.hasTransform).toBe(false)
    expect(sample.runningAnimations).toBe(0)
  }
}

test.describe('with motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('popover animates from trigger origin and settles within 250ms', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)

    const trace = await traceAppearance(page, POPOVER, () => colorSwatch(page).click())

    const [first] = trace.samples
    expect(first?.opacity).toBe(0)
    expect(first?.scale).toBeCloseTo(MENU_FROM_SCALE, SCALE_DIGITS)
    // Timing is read from the animations themselves: wall-clock frames stretch when the parallel
    // suites load the machine, but a 250ms animation with no delay settles at 250ms.
    const longest = Math.max(...trace.samples.map((sample) => sample.longestAnimationMs))
    expect(longest).toBeGreaterThan(0)
    expect(longest).toBeLessThanOrEqual(MENU_OPEN_MS)
    expect(Math.max(...trace.samples.map((sample) => sample.longestDelayMs))).toBe(0)
    expect(trace.settledAtMs).not.toBeNull()
    // The picker opens to the right of its swatch, so it grows from its left edge, not its center.
    const last = trace.samples.at(-1)
    expect(last?.transformOrigin.startsWith('0px ')).toBe(true)
  })

  test('a popover closed by a press outside fades out within 150ms', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    await colorSwatch(page).click()
    await expect(page.locator(POPOVER)).toBeVisible()

    // A raw press: the modal picker makes the rest of the page inert to Playwright's own clicks.
    const pane = await page.locator('.react-flow__pane').boundingBox()
    if (pane === null) throw new Error('The canvas pane has no box')
    const exit = await traceExit(page, POPOVER, () =>
      page.mouse.click(pane.x + OUTSIDE_INSET_PX, pane.y + pane.height / 2),
    )

    // A close is never delayed, and it leaves once its 150ms fade is done.
    expect(exit.longestAnimationMs).toBeGreaterThan(0)
    expect(exit.longestAnimationMs).toBeLessThanOrEqual(MENU_CLOSE_MS)
    expect(exit.longestDelayMs).toBe(0)
    expect(exit.opacities.some((opacity) => opacity > 0 && opacity < 1)).toBe(true)
    expect(exit.removedAfterMs).not.toBeNull()
  })

  test('the picker can be closed mid-open and reopened while it leaves', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const swatch = colorSwatch(page)
    const popover = page.locator(POPOVER)

    // The whole sequence runs inside the page, so each press lands inside the animation it
    // interrupts however busy the machine is (Playwright's own presses wait out round trips).
    const observed = await swatch.evaluate(
      async (trigger, { selector, insetPx, timeoutMs }) => {
        const pane = document.querySelector('.react-flow__pane')
        if (pane === null) throw new Error('The canvas pane is missing')
        const press = (target: Element): void => {
          const box = target.getBoundingClientRect()
          const at = { clientX: box.x + insetPx, clientY: box.y + box.height / 2 }
          const init = { ...at, bubbles: true, button: 0, isPrimary: true, pointerType: 'mouse' }
          target.dispatchEvent(new PointerEvent('pointerdown', init))
          target.dispatchEvent(new PointerEvent('pointerup', init))
          target.dispatchEvent(new MouseEvent('click', init))
        }
        const content = (): Element | null => document.querySelector(selector)
        const opacity = (): number => {
          const element = content()
          return element === null ? Number.NaN : Number(getComputedStyle(element).opacity)
        }
        const nextTask = (): Promise<void> =>
          new Promise((resolve) => {
            setTimeout(resolve, 0)
          })
        const until = async (step: string, isDone: () => boolean): Promise<void> => {
          const startedAt = performance.now()
          while (!isDone()) {
            if (performance.now() - startedAt > timeoutMs) throw new Error(`Timed out ${step}`)
            await new Promise(requestAnimationFrame)
          }
        }

        press(trigger)
        // Radix listens for outside presses a task after the content mounts: wait a frame and a task.
        await new Promise(requestAnimationFrame)
        await nextTask()
        const openingOpacity = opacity()
        press(pane)
        await until('closing mid-open', () => content() === null)

        press(trigger)
        await until('opening', () => opacity() === 1 && content()?.getAnimations().length === 0)
        press(pane)
        await new Promise(requestAnimationFrame)
        const wasLeaving = content()?.getAttribute('data-state') === 'closed'
        press(trigger)
        return { openingOpacity, wasLeaving }
      },
      { selector: POPOVER, insetPx: OUTSIDE_INSET_PX, timeoutMs: 2000 },
    )

    expect(observed.openingOpacity).toBeLessThan(1)
    expect(observed.wasLeaving).toBe(true)
    await expect(popover).toHaveAttribute('data-state', 'open')
    await expect(popover).toHaveCSS('opacity', '1')
    await expect(swatch).toHaveAttribute('aria-expanded', 'true')
  })

  test('a dialog opened with the pointer scales up from 0.96 around its center', async ({
    page,
  }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)

    const trace = await traceAppearance(page, ALERT_DIALOG, () =>
      page.getByRole('button', { name: 'New graph' }).click(),
    )

    const [first] = trace.samples
    expect(first?.opacity).toBe(0)
    expect(first?.scale).toBeCloseTo(DIALOG_FROM_SCALE, SCALE_DIGITS)
    expect(trace.settledAtMs).not.toBeNull()
    const [originX = Number.NaN, originY = Number.NaN] = (
      trace.samples.at(-1)?.transformOrigin ?? ''
    )
      .split(' ')
      .map(Number.parseFloat)
    expect(originX).toBeCloseTo(trace.width / 2, 0)
    expect(originY).toBeCloseTo(trace.height / 2, 0)
  })

  test('overlays opened with the pointer leave at once on Escape and give focus back', async ({
    page,
  }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    const lighting = graphNode(page, 'Master Stack').getByRole('combobox', { name: 'Lighting' })
    for (const [opener, selector] of [
      [page.getByRole('button', { name: 'New graph' }), ALERT_DIALOG],
      [colorSwatch(page), POPOVER],
      [lighting, SELECT],
    ] as const) {
      await opener.click()
      await expect(page.locator(selector)).toHaveCount(1)
      const exit = await traceExit(page, selector, () => page.keyboard.press('Escape'))
      // A close from the keyboard has nothing to animate.
      expect(exit.longestAnimationMs).toBe(0)
      await expectFocusRing(page, opener)
    }
  })

  test('a switch thumb travels continuously on a zoomed canvas', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)
    for (let step = 0; step < ZOOM_OUT_STEPS; step += 1) {
      await page.getByRole('button', { name: 'Zoom canvas out' }).click()
    }
    const twoSided = graphNode(page, 'Master Stack').getByRole('switch', { name: 'Two sided' })
    const thumb = twoSided.locator('[data-slot="switch-thumb"]')
    // Wait out the zoom so the thumb's box only moves with its own animation.
    await expect(async () => {
      const before = await thumb.boundingBox()
      await page.waitForTimeout(MID_ANIMATION_MS)
      expect(await thumb.boundingBox()).toEqual(before)
    }).toPass()
    const track = await twoSided.boundingBox()
    const start = await thumb.boundingBox()
    if (track === null || start === null) throw new Error('The switch has no box')

    const xs = await thumb.evaluate(
      (element, { timeoutMs, stillFrames }) =>
        new Promise<number[]>((resolve) => {
          const startedAt = performance.now()
          element.closest('button')?.click()
          // Read in the same task as the press: whatever moves later is the animation.
          const samples = [element.getBoundingClientRect().x]
          const tick = (now: number): void => {
            samples.push(element.getBoundingClientRect().x)
            // Still for a few frames with nothing running (layout animations run outside WAAPI).
            const recent = samples.slice(-stillFrames)
            const isStill = recent.length === stillFrames && recent.every((x) => x === recent[0])
            if ((isStill && element.getAnimations().length === 0) || now - startedAt > timeoutMs) {
              resolve(samples)
            } else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }),
      { timeoutMs: 1000, stillFrames: 4 },
    )

    // On: the thumb ends against the track's right edge (inside its border), at any zoom.
    const { layoutWidth, borderLeftPx } = await twoSided.evaluate((element) => ({
      // The unscaled width: the canvas zoom is a transform, which offsetWidth ignores.
      layoutWidth: element instanceof HTMLElement ? element.offsetWidth : Number.NaN,
      borderLeftPx: Number.parseFloat(getComputedStyle(element).borderLeftWidth),
    }))
    const zoom = track.width / layoutWidth
    const end = xs.at(-1) ?? Number.NaN
    expect(end + start.width).toBeCloseTo(track.x + track.width - borderLeftPx * zoom, 0)
    // It leaves from where it was, without a jump on the first frame, and eases the rest.
    const travel = end - start.x
    expect(xs[0] ?? Number.NaN).toBeCloseTo(start.x, 0)
    expect((xs[1] ?? Number.NaN) - start.x).toBeLessThan(travel * FIRST_FRAME_SHARE)
    expect(xs.some((x) => x > start.x + travel / 2 && x < end - 0.5)).toBe(true)
  })

  test('keyboard-opened command palette and add-node menu do not animate', async ({ page }) => {
    await openCanvas(page, TIME_AND_SINE)
    await graphNode(page, 'Time').focus()

    const palette = await traceAppearance(page, COMMAND_PALETTE, () =>
      page.keyboard.press(PALETTE_CHORD),
    )
    expectNeverAnimated(palette)
    const paletteExit = await traceExit(page, COMMAND_PALETTE, () => page.keyboard.press('Escape'))
    expect(paletteExit.longestAnimationMs).toBe(0)
    await expect(graphNode(page, 'Time')).toBeFocused()

    const addNode = await traceAppearance(page, DIALOG, () => page.keyboard.press('Space'))
    expectNeverAnimated(addNode)
    const addNodeExit = await traceExit(page, DIALOG, () => page.keyboard.press('Escape'))
    expect(addNodeExit.longestAnimationMs).toBe(0)
    await expect(page.locator(DIALOG)).toHaveCount(0)

    const outputPort = graphNode(page, 'Time').getByRole('button', { name: /^Out, output port/ })
    await tabUntilFocused(page, outputPort)
    const connectList = await traceAppearance(page, POPOVER, () => page.keyboard.press('Enter'))
    expectNeverAnimated(connectList)
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('reduced motion: overlays only fade (no transform)', async ({ page }) => {
    await openCanvas(page, COLOR_TO_BASE_COLOR)

    for (const [selector, open] of [
      [POPOVER, () => colorSwatch(page).click()],
      [ALERT_DIALOG, () => page.getByRole('button', { name: 'New graph' }).click()],
    ] as const) {
      const trace = await traceAppearance(page, selector, open)
      expect(trace.samples[0]?.opacity).toBe(0)
      expect(trace.samples.at(-1)?.opacity).toBe(1)
      for (const sample of trace.samples) {
        expect(sample.hasTransform).toBe(false)
        expect(sample.filter).toBe('none')
      }
      await page.keyboard.press('Escape')
      await expect(page.locator(selector)).toHaveCount(0)
    }
  })
})
