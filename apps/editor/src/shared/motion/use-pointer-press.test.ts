import { describe, expect, it } from 'vitest'

import { isPointerPress } from './use-pointer-press'

describe('isPointerPress', () => {
  it('accepts the primary button of a mouse, a pen and a finger', () => {
    for (const pointerType of ['mouse', 'pen', 'touch']) {
      expect(isPointerPress({ pointerType, isPrimary: true, button: 0 })).toBe(true)
    }
  })

  it('ignores the synthetic pointerdown script fires for Enter (no pointer type)', () => {
    expect(isPointerPress({ pointerType: '', isPrimary: true, button: 0 })).toBe(false)
  })

  it('ignores secondary buttons and secondary touches', () => {
    expect(isPointerPress({ pointerType: 'mouse', isPrimary: true, button: 2 })).toBe(false)
    expect(isPointerPress({ pointerType: 'touch', isPrimary: false, button: 0 })).toBe(false)
  })
})
