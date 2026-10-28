import type { Page } from '@playwright/test'

/** Frames the transforms must hold before they count as still. */
const DEFAULT_STILL_FRAMES = 10
const STILL_TIMEOUT_MS = 10_000

export interface StillOptions {
  /**
   * Frames in a row with the same transforms. A guard that something does not start moving (a fit
   * that should not happen) asks for more frames, so a late start still shows.
   */
  readonly stillFrames?: number
}

/**
 * Resolves once the computed transform of the first element matching each selector has stayed the
 * same for a few animation frames in a row (a glide, a zoom or a fit has ended), and returns those
 * transforms in selector order. Counting frames instead of milliseconds keeps it right on a slow,
 * loaded machine.
 */
export async function stillTransforms(
  page: Page,
  selectors: readonly string[],
  options: StillOptions = {},
): Promise<readonly string[]> {
  return page.evaluate(
    ({ targets, stillFrames, timeoutMs }) =>
      new Promise<string[]>((resolve, reject) => {
        const elements = targets.flatMap((selector) => {
          const element = document.querySelector(selector)
          return element === null ? [] : [element]
        })
        if (elements.length !== targets.length) {
          reject(new Error(`Not rendered: ${targets.join(', ')}`))
          return
        }
        const startedAt = performance.now()
        let previous = ''
        let stillCount = 0
        const check = (): void => {
          const transforms = elements.map((element) => getComputedStyle(element).transform)
          const current = transforms.join('|')
          stillCount = current === previous ? stillCount + 1 : 0
          previous = current
          if (stillCount >= stillFrames) {
            resolve(transforms)
            return
          }
          if (performance.now() - startedAt > timeoutMs) {
            reject(new Error(`Still moving after ${String(timeoutMs)} ms: ${targets.join(', ')}`))
            return
          }
          requestAnimationFrame(check)
        }
        requestAnimationFrame(check)
      }),
    {
      targets: selectors,
      stillFrames: options.stillFrames ?? DEFAULT_STILL_FRAMES,
      timeoutMs: STILL_TIMEOUT_MS,
    },
  )
}
