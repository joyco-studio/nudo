import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTemplatePreviewScheduler } from './template-preview-scheduler'
import type { TemplatePreviewState } from './template-preview-scheduler'

const DELAY_MS = 150

/** A material the fake compiler hands out: which template it is, and whether it was released. */
interface FakeMaterial {
  readonly id: string
  isReleased: boolean
}

function setUp(failing: ReadonlySet<string> = new Set()) {
  const compiled: FakeMaterial[] = []
  const states: TemplatePreviewState<string, FakeMaterial>[] = []
  const scheduler = createTemplatePreviewScheduler<string, FakeMaterial>({
    delayMs: DELAY_MS,
    compile: (id) => {
      if (failing.has(id)) return null
      const material = { id, isReleased: false }
      compiled.push(material)
      return material
    },
    release: (material) => {
      material.isReleased = true
    },
    onChange: (state) => states.push(state),
  })
  const latest = () => states.at(-1)
  return { scheduler, compiled, states, latest }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createTemplatePreviewScheduler', () => {
  it('says it is compiling at once, and compiles after the quiet period', () => {
    const { scheduler, compiled, latest } = setUp()

    scheduler.select('pond')
    expect(latest()).toEqual({ status: 'compiling', id: 'pond' })
    vi.advanceTimersByTime(DELAY_MS - 1)
    expect(compiled).toHaveLength(0)

    vi.advanceTimersByTime(1)
    expect(compiled.map((material) => material.id)).toEqual(['pond'])
    expect(latest()).toEqual({ status: 'ready', id: 'pond', material: compiled[0] })
  })

  it('compiles only the last of several quick selections', () => {
    const { scheduler, compiled, latest } = setUp()

    scheduler.select('pond')
    vi.advanceTimersByTime(DELAY_MS / 2)
    scheduler.select('water')
    vi.advanceTimersByTime(DELAY_MS / 2)
    scheduler.select('blob')
    vi.advanceTimersByTime(DELAY_MS)

    expect(compiled.map((material) => material.id)).toEqual(['blob'])
    expect(latest()).toMatchObject({ status: 'ready', id: 'blob' })
  })

  it('does nothing when the shown template is selected again', () => {
    const { scheduler, compiled, states } = setUp()
    scheduler.select('pond')
    vi.advanceTimersByTime(DELAY_MS)
    const statesBefore = states.length

    scheduler.select('pond')
    vi.advanceTimersByTime(DELAY_MS)

    expect(compiled).toHaveLength(1)
    expect(states).toHaveLength(statesBefore)
  })

  it('reports a template that does not compile', () => {
    const { scheduler, latest } = setUp(new Set(['broken']))

    scheduler.select('broken')
    vi.advanceTimersByTime(DELAY_MS)

    expect(latest()).toEqual({ status: 'failed', id: 'broken' })
  })

  it('leaves a material handed over to the scene for the scene to free', () => {
    const { scheduler, compiled } = setUp()
    scheduler.select('pond')
    vi.advanceTimersByTime(DELAY_MS)
    scheduler.select('water')
    vi.advanceTimersByTime(DELAY_MS)
    const [pond, water] = compiled
    if (pond === undefined || water === undefined) throw new Error('Nothing compiled')

    scheduler.handOver(pond)
    scheduler.dispose()

    expect(pond.isReleased).toBe(false)
    expect(water.isReleased).toBe(true)
  })

  it('releases every material it compiled and kept when disposed, and compiles nothing after', () => {
    const { scheduler, compiled } = setUp()
    scheduler.select('pond')
    vi.advanceTimersByTime(DELAY_MS)
    scheduler.select('water')
    vi.advanceTimersByTime(DELAY_MS)
    scheduler.select('blob')

    scheduler.dispose()
    vi.advanceTimersByTime(DELAY_MS)

    expect(compiled.map((material) => material.id)).toEqual(['pond', 'water'])
    expect(compiled.every((material) => material.isReleased)).toBe(true)
  })
})

/** A compiler whose textures load later: each compile waits until the test settles it. */
function setUpAsync() {
  const compiled: FakeMaterial[] = []
  const states: TemplatePreviewState<string, FakeMaterial>[] = []
  const pending: { id: string; settle: (isOk: boolean) => void }[] = []
  const scheduler = createTemplatePreviewScheduler<string, FakeMaterial>({
    delayMs: DELAY_MS,
    compile: (id) =>
      new Promise<FakeMaterial | null>((resolve) => {
        pending.push({
          id,
          settle: (isOk) => {
            if (!isOk) {
              resolve(null)
              return
            }
            const material = { id, isReleased: false }
            compiled.push(material)
            resolve(material)
          },
        })
      }),
    release: (material) => {
      material.isReleased = true
    },
    onChange: (state) => states.push(state),
  })
  const settle = async (id: string, isOk = true): Promise<void> => {
    pending.find((entry) => entry.id === id)?.settle(isOk)
    await vi.runAllTimersAsync()
  }
  return { scheduler, compiled, states, latest: () => states.at(-1), settle }
}

describe('createTemplatePreviewScheduler with a compiler that waits for textures', () => {
  it('stays compiling until the material arrives, then reports it', async () => {
    const { scheduler, compiled, latest, settle } = setUpAsync()

    scheduler.select('fixture')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    expect(latest()).toEqual({ status: 'compiling', id: 'fixture' })

    await settle('fixture')
    expect(latest()).toEqual({ status: 'ready', id: 'fixture', material: compiled[0] })
  })

  it('reports a template whose compile resolves to nothing as failed', async () => {
    const { scheduler, latest, settle } = setUpAsync()

    scheduler.select('fixture')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    await settle('fixture', false)

    expect(latest()).toEqual({ status: 'failed', id: 'fixture' })
  })

  it('frees a material that arrives after a newer selection, and never reports it', async () => {
    const { scheduler, compiled, states, latest, settle } = setUpAsync()

    scheduler.select('fixture')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    scheduler.select('pond')
    await settle('fixture')

    expect(compiled[0]?.isReleased).toBe(true)
    expect(states.some((state) => state.status === 'ready')).toBe(false)
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    await settle('pond')
    expect(latest()).toEqual({ status: 'ready', id: 'pond', material: compiled[1] })
  })

  it('frees a material that arrives after the browser closed', async () => {
    const { scheduler, compiled, states, settle } = setUpAsync()

    scheduler.select('fixture')
    await vi.advanceTimersByTimeAsync(DELAY_MS)
    const reported = states.length
    scheduler.dispose()
    await settle('fixture')

    expect(compiled[0]?.isReleased).toBe(true)
    expect(states).toHaveLength(reported)
  })
})
