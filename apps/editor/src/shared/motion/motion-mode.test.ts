import { afterEach, describe, expect, it } from 'vitest'

import { INPUT_MODALITY_ATTRIBUTE } from '@/shared/lib/input-modality'

import { motionModeFor } from './motion-mode'

function lastPressWas(modality: 'keyboard' | 'pointer'): void {
  document.documentElement.setAttribute(INPUT_MODALITY_ATTRIBUTE, modality)
}

describe('motionModeFor', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(INPUT_MODALITY_ATTRIBUTE)
  })

  it('moves fully after a pointer press', () => {
    lastPressWas('pointer')
    expect(motionModeFor(false, document)).toBe('full')
  })

  it('only fades with reduced motion', () => {
    lastPressWas('pointer')
    expect(motionModeFor(true, document)).toBe('reduced')
  })

  it('is instant for whatever a key started, reduced motion or not', () => {
    lastPressWas('keyboard')
    expect(motionModeFor(false, document)).toBe('instant')
    expect(motionModeFor(true, document)).toBe('instant')
  })
})
