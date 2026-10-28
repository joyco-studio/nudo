import type { Page } from '@playwright/test'

/** Longer than the slowest tooltip delay in the editor: a port type or scrub hint, 700 ms. */
const PAST_TOOLTIP_DELAY_MS = 800

/**
 * Runs the page clock past every tooltip's open delay, so a tooltip that was going to open has.
 * The clock must be installed (`page.clock.install()`) before the page loads. A guard that a
 * tooltip stays closed can then fail for real, however slowly the machine runs its timers.
 */
export async function runPastTooltipDelays(page: Page): Promise<void> {
  await page.clock.runFor(PAST_TOOLTIP_DELAY_MS)
  // Two frames for whatever those timers set off (a tooltip opening) to render.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      }),
  )
}
