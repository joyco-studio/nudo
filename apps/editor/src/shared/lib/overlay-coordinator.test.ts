import { afterEach, describe, expect, it } from 'vitest'

import { claimOverlay, isOverlayReplaced, releaseOverlay } from './overlay-coordinator'

describe('overlay coordinator', () => {
  afterEach(() => {
    for (const id of ['first', 'second']) releaseOverlay(id)
  })

  it('tells a replaced overlay from one that closed on its own', () => {
    claimOverlay('first')
    expect(isOverlayReplaced('first')).toBe(false)
    releaseOverlay('first')
    expect(isOverlayReplaced('first')).toBe(false)
  })

  it('still knows an overlay was replaced after its replacement has closed too', () => {
    // A replaced overlay restores focus only once its exit animation ends; by then the one that
    // replaced it may be closed already, and focus must stay where that one put it.
    claimOverlay('first')
    claimOverlay('second')
    expect(isOverlayReplaced('first')).toBe(true)
    releaseOverlay('second')
    expect(isOverlayReplaced('first')).toBe(true)
    expect(isOverlayReplaced('second')).toBe(false)
  })

  it('forgets the replacement once the overlay opens again', () => {
    claimOverlay('first')
    claimOverlay('second')
    claimOverlay('first')
    expect(isOverlayReplaced('first')).toBe(false)
    expect(isOverlayReplaced('second')).toBe(true)
  })
})
