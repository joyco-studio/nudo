import { describe, expect, it } from 'vitest'

import { colorRampGradientCss } from './color-ramp-gradient'
import { colorRampColorAt } from './color-ramp-stops'
import type { ColorRampStop } from './color-ramp-stops'

const BLACK_TO_WHITE: readonly ColorRampStop[] = [
  { position: 0, color: [0, 0, 0] },
  { position: 1, color: [1, 1, 1] },
]

const STEPS: readonly ColorRampStop[] = [
  { position: 0, color: [0, 0, 0] },
  { position: 0.5, color: [1, 0, 0] },
  { position: 0.75, color: [1, 1, 1] },
]

describe('colorRampColorAt', () => {
  it('mixes linearly between neighbouring stops', () => {
    expect(colorRampColorAt(BLACK_TO_WHITE, 'linear', 0.25)).toEqual([0.25, 0.25, 0.25])
  })

  it('eases the segment ends when smooth', () => {
    const [red] = colorRampColorAt(BLACK_TO_WHITE, 'smooth', 0.25)
    expect(red).toBeCloseTo(0.15625)
  })

  it('holds each color until the next stop when constant', () => {
    expect(colorRampColorAt(STEPS, 'constant', 0.6)).toEqual([1, 0, 0])
    expect(colorRampColorAt(STEPS, 'constant', 0.75)).toEqual([1, 1, 1])
  })

  it('jumps cleanly where two stops share a position', () => {
    const jump: readonly ColorRampStop[] = [
      { position: 0.5, color: [0, 0, 0] },
      { position: 0.5, color: [1, 1, 1] },
    ]
    expect(colorRampColorAt(jump, 'linear', 0.49)).toEqual([0, 0, 0])
    expect(colorRampColorAt(jump, 'linear', 0.51)).toEqual([1, 1, 1])
  })
})

describe('colorRampGradientCss', () => {
  it('draws hard edges at the stops of a constant ramp, in sRGB', () => {
    expect(colorRampGradientCss(STEPS, 'constant')).toBe(
      'linear-gradient(to right, rgb(0 0 0) 0%, rgb(0 0 0) 50%, rgb(255 0 0) 50%, ' +
        'rgb(255 0 0) 75%, rgb(255 255 255) 75%, rgb(255 255 255) 100%)',
    )
  })

  it('samples a blended ramp in linear space and converts each sample to sRGB', () => {
    const css = colorRampGradientCss(BLACK_TO_WHITE, 'linear')
    expect(css.startsWith('linear-gradient(to right, rgb(0 0 0) 0%,')).toBe(true)
    // Linear 0.5 is sRGB 188, not the 128 a plain CSS black-to-white gradient shows there.
    expect(css).toContain('rgb(188 188 188) 50%')
    expect(css.endsWith('rgb(255 255 255) 100%)')).toBe(true)
  })
})
