import { describe, expect, it } from 'vitest'

import { isRenderDue, pickRoundRobin } from './preview-scheduler'
import type { PreviewTiming } from './preview-scheduler'

const INTERVAL_MS = 50

const timing = (changes: Partial<PreviewTiming>): PreviewTiming => ({
  isVisible: true,
  isDirty: false,
  isAnimated: false,
  lastRenderAt: null,
  ...changes,
})

describe('isRenderDue', () => {
  it('renders a visible dirty preview right away', () => {
    expect(isRenderDue(timing({ isDirty: true }), 0, INTERVAL_MS)).toBe(true)
  })

  it('never renders off screen, dirty or animated', () => {
    expect(isRenderDue(timing({ isVisible: false, isDirty: true }), 0, INTERVAL_MS)).toBe(false)
    expect(isRenderDue(timing({ isVisible: false, isAnimated: true }), 0, INTERVAL_MS)).toBe(false)
  })

  it('leaves an up-to-date static preview alone', () => {
    expect(isRenderDue(timing({ lastRenderAt: 0 }), 1000, INTERVAL_MS)).toBe(false)
  })

  it('renders an animated preview once per interval', () => {
    const animated = timing({ isAnimated: true, lastRenderAt: 100 })
    expect(isRenderDue(animated, 149, INTERVAL_MS)).toBe(false)
    expect(isRenderDue(animated, 150, INTERVAL_MS)).toBe(true)
  })
})

describe('pickRoundRobin', () => {
  const keys = ['a', 'b', 'c', 'd', 'e']
  const allDue = (): boolean => true

  it('takes at most the budget and resumes after the last one served', () => {
    const first = pickRoundRobin(keys, allDue, 2, 0)
    const second = pickRoundRobin(keys, allDue, 2, first.nextStart)
    const third = pickRoundRobin(keys, allDue, 2, second.nextStart)

    expect(first.picked).toEqual(['a', 'b'])
    expect(second.picked).toEqual(['c', 'd'])
    expect(third.picked).toEqual(['e', 'a'])
  })

  it('skips keys that are not due', () => {
    expect(pickRoundRobin(keys, (key) => key !== 'b', 2, 0).picked).toEqual(['a', 'c'])
  })

  it('picks nothing from an empty list', () => {
    expect(pickRoundRobin([], allDue, 4, 3)).toEqual({ picked: [], nextStart: 0 })
  })
})
