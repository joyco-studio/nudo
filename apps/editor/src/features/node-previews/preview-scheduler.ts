/** What the scheduler needs to know about one preview to decide whether it renders this frame. */
export interface PreviewTiming {
  /** On screen (its canvas intersects the viewport). Off-screen previews never render. */
  readonly isVisible: boolean
  /** Its picture is out of date: a new material, a value change or a new shape. */
  readonly isDirty: boolean
  /** It changes every frame (Time upstream), so it re-renders on its own at the frame rate cap. */
  readonly isAnimated: boolean
  /** When it last rendered, on the frame clock; `null` before the first render. */
  readonly lastRenderAt: number | null
}

/** Milliseconds between two renders of one animated preview at `fps` frames per second. */
export const frameIntervalMs = (fps: number): number => 1000 / fps

/**
 * A visible preview renders when it is dirty, or when it is animated and its last render is at
 * least one frame interval old. Nothing off-screen ever renders.
 */
export function isRenderDue(timing: PreviewTiming, now: number, minIntervalMs: number): boolean {
  if (!timing.isVisible) return false
  if (timing.isDirty) return true
  if (!timing.isAnimated) return false
  return timing.lastRenderAt === null || now - timing.lastRenderAt >= minIntervalMs
}

export interface RoundRobinPick<K> {
  readonly picked: readonly K[]
  /** Where the next frame starts looking, right after the last preview served. */
  readonly nextStart: number
}

/**
 * Picks at most `budget` due keys, starting at `start` and wrapping around, so when more previews
 * are due than one frame allows, the ones skipped now go first next frame.
 */
export function pickRoundRobin<K>(
  keys: readonly K[],
  isDue: (key: K) => boolean,
  budget: number,
  start: number,
): RoundRobinPick<K> {
  const picked: K[] = []
  if (keys.length === 0) return { picked, nextStart: 0 }
  const first = start % keys.length
  let nextStart = first
  for (let offset = 0; offset < keys.length && picked.length < budget; offset += 1) {
    const index = (first + offset) % keys.length
    const key = keys[index]
    if (key === undefined || !isDue(key)) continue
    picked.push(key)
    nextStart = (index + 1) % keys.length
  }
  return { picked, nextStart }
}

/** The browser's frame callbacks, injectable so tests drive frames by hand. */
export interface FrameClock {
  now(): number
  requestFrame(callback: (now: number) => void): number
  cancelFrame(handle: number): void
}

export const browserFrameClock: FrameClock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => {
    cancelAnimationFrame(handle)
  },
}

export interface FrameLoop {
  /** Asks for a frame, unless one is already coming. */
  request(): void
  dispose(): void
}

/**
 * Runs `onFrame` once per animation frame while it reports more work, and stops (no idle frames)
 * once it returns false until `request` is called again.
 */
export function createFrameLoop(onFrame: (now: number) => boolean, clock: FrameClock): FrameLoop {
  let handle: number | null = null
  let isDisposed = false

  const run = (now: number): void => {
    handle = null
    if (isDisposed) return
    if (onFrame(now)) request()
  }

  function request(): void {
    if (isDisposed || handle !== null) return
    handle = clock.requestFrame(run)
  }

  return {
    request,
    dispose() {
      isDisposed = true
      if (handle !== null) clock.cancelFrame(handle)
      handle = null
    },
  }
}
