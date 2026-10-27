import type { Page } from '@playwright/test'

/** One frame of an element's motion, read from its computed style. */
export interface MotionSample {
  /** Since the element was inserted, in ms. */
  readonly timeMs: number
  readonly opacity: number
  /** Horizontal scale of the computed transform; 1 when there is none. */
  readonly scale: number
  /** False for `none` and for an identity matrix. */
  readonly hasTransform: boolean
  readonly filter: string
  readonly transformOrigin: string
  /** Animations running on the element (motion drives transform and opacity through WAAPI). */
  readonly runningAnimations: number
  /** The longest declared duration among them, in ms; 0 with none running. */
  readonly longestAnimationMs: number
  /** The longest declared start delay among them, in ms. */
  readonly longestDelayMs: number
}

export interface MotionTrace {
  readonly samples: readonly MotionSample[]
  /** When the element reached full opacity, no transform and no animation, and held it. */
  readonly settledAtMs: number | null
  readonly width: number
  readonly height: number
}

interface TraceOptions {
  readonly selector: string
  readonly stableFrames: number
  readonly timeoutMs: number
}

const STABLE_FRAMES = 3
const TRACE_TIMEOUT_MS = 2000

/**
 * The trace is wrapped in an object because `evaluateHandle` would otherwise wait for it.
 *
 * Samples the first element matching `selector` from the moment it is inserted (a mutation
 * observer, before the first paint) on every frame until it holds still. `act` is what opens it.
 */
export async function traceAppearance(
  page: Page,
  selector: string,
  act: () => Promise<void>,
): Promise<MotionTrace> {
  const options: TraceOptions = {
    selector,
    stableFrames: STABLE_FRAMES,
    timeoutMs: TRACE_TIMEOUT_MS,
  }
  const pending = await page.evaluateHandle(
    ({ selector: target, stableFrames, timeoutMs }) => ({
      done: new Promise<MotionTrace>((resolve) => {
        const samples: MotionSample[] = []
        let startedAt = 0

        const read = (element: Element, now: number): MotionSample => {
          const style = getComputedStyle(element)
          const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? '' : style.transform)
          const animations = element.getAnimations()
          const timings = animations.map((animation) => animation.effect?.getComputedTiming())
          const durations = timings.map((timing) => Number(timing?.duration ?? 0))
          const delays = timings.map((timing) => timing?.delay ?? 0)
          return {
            timeMs: now - startedAt,
            opacity: Number(style.opacity),
            scale: matrix.a,
            hasTransform: !matrix.isIdentity,
            filter: style.filter,
            transformOrigin: style.transformOrigin,
            runningAnimations: animations.filter((animation) => animation.playState === 'running')
              .length,
            longestAnimationMs: Math.max(0, ...durations.filter(Number.isFinite)),
            longestDelayMs: Math.max(0, ...delays),
          }
        }

        const isAtRest = (sample: MotionSample): boolean =>
          sample.opacity === 1 && !sample.hasTransform && sample.runningAnimations === 0

        const finish = (element: Element): void => {
          let restingFrom = samples.length
          for (let index = samples.length - 1; index >= 0; index -= 1) {
            const sample = samples[index]
            if (sample === undefined || !isAtRest(sample)) break
            restingFrom = index
          }
          const settled = samples[restingFrom]
          const box = element.getBoundingClientRect()
          resolve({
            samples,
            settledAtMs: settled === undefined ? null : settled.timeMs,
            width: box.width,
            height: box.height,
          })
        }

        const follow = (element: Element): void => {
          startedAt = performance.now()
          samples.push(read(element, startedAt))
          const tick = (now: number): void => {
            samples.push(read(element, now))
            const recent = samples.slice(-stableFrames)
            const isStill = recent.length === stableFrames && recent.every(isAtRest)
            if (isStill || now - startedAt > timeoutMs) finish(element)
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }

        const observer = new MutationObserver(() => {
          const element = document.querySelector(target)
          if (element === null) return
          observer.disconnect()
          follow(element)
        })
        observer.observe(document.body, { childList: true, subtree: true })
      }),
    }),
    options,
  )
  await act()
  return pending.evaluate((watch) => watch.done)
}

export interface ExitTrace {
  /** Opacity on each frame while the element was still in the document. */
  readonly opacities: readonly number[]
  /** From the element turning `data-state="closed"` until it left the document; null if never. */
  readonly removedAfterMs: number | null
  /** The longest declared duration among the animations it ran while closing, in ms. */
  readonly longestAnimationMs: number
  /** The longest declared start delay among them, in ms. */
  readonly longestDelayMs: number
}

/** Follows the element matching `selector` (already open) until `act` makes it leave. */
export async function traceExit(
  page: Page,
  selector: string,
  act: () => Promise<void>,
): Promise<ExitTrace> {
  const pending = await page.evaluateHandle(
    ({ selector: target, timeoutMs }) => ({
      done: new Promise<ExitTrace>((resolve) => {
        const element = document.querySelector(target)
        if (element === null) {
          resolve({ opacities: [], removedAfterMs: null, longestAnimationMs: 0, longestDelayMs: 0 })
          return
        }
        const opacities: number[] = []
        let longestAnimationMs = 0
        let longestDelayMs = 0
        let closingSince: number | null = null
        const startedAt = performance.now()
        const tick = (now: number): void => {
          if (!element.isConnected) {
            const removedAfterMs = closingSince === null ? null : now - closingSince
            resolve({ opacities, removedAfterMs, longestAnimationMs, longestDelayMs })
            return
          }
          const opacity = Number(getComputedStyle(element).opacity)
          if (closingSince === null && element.getAttribute('data-state') === 'closed') {
            closingSince = now
          }
          if (closingSince !== null) {
            opacities.push(opacity)
            for (const animation of element.getAnimations()) {
              const timing = animation.effect?.getComputedTiming()
              const duration = Number(timing?.duration ?? 0)
              if (Number.isFinite(duration))
                longestAnimationMs = Math.max(longestAnimationMs, duration)
              longestDelayMs = Math.max(longestDelayMs, timing?.delay ?? 0)
            }
          }
          if (now - startedAt > timeoutMs) {
            resolve({ opacities, removedAfterMs: null, longestAnimationMs, longestDelayMs })
          } else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    }),
    { selector, timeoutMs: TRACE_TIMEOUT_MS },
  )
  await act()
  return pending.evaluate((watch) => watch.done)
}
