import { describe, expect, it } from 'vitest'

import {
  hexToSrgb,
  hsvToSrgb,
  linearToSrgb,
  srgbToHex,
  srgbToHsv,
  srgbToLinear,
  withSrgb,
} from './color-math'
import type { Rgb } from './color-math'

const ONE_STEP = 1 / 255

function expectRgbClose(actual: Rgb, expected: Rgb, tolerance: number): void {
  actual.forEach((channel, index) => {
    expect(Math.abs(channel - (expected[index] ?? Number.NaN))).toBeLessThanOrEqual(tolerance)
  })
}

/** Every 8-bit level of one channel, with the other two fixed so all three positions are hit. */
function eightBitColors(): readonly Rgb[] {
  const colors: Rgb[] = []
  for (let level = 0; level <= 255; level += 1) {
    const unit = level / 255
    colors.push([unit, 0.5, 1 - unit], [0.25, unit, 0.75], [1 - unit, unit, unit])
  }
  return colors
}

describe('hexToSrgb', () => {
  it('reads #rrggbb as 0..1 channels', () => {
    expect(hexToSrgb('#000000')).toEqual([0, 0, 0])
    expect(hexToSrgb('#ffffff')).toEqual([1, 1, 1])
    expect(hexToSrgb('#1a2b3c')).toEqual([26 / 255, 43 / 255, 60 / 255])
  })

  it('accepts uppercase hex', () => {
    expect(hexToSrgb('#FF0000')).toEqual([1, 0, 0])
  })

  it('returns null for text that is not a 6-digit hex color', () => {
    expect(hexToSrgb('red')).toBeNull()
    expect(hexToSrgb('#fff')).toBeNull()
    expect(hexToSrgb('#1a2b3g')).toBeNull()
  })
})

describe('srgbToHex', () => {
  it('writes lowercase #rrggbb', () => {
    expect(srgbToHex([26 / 255, 43 / 255, 60 / 255])).toBe('#1a2b3c')
  })

  it('clamps out-of-range channels', () => {
    expect(srgbToHex([4, -1, 0.5])).toBe('#ff0080')
  })

  it('round-trips every 8-bit level through hex', () => {
    for (let level = 0; level <= 255; level += 1) {
      const hex = `#${level.toString(16).padStart(2, '0').repeat(3)}`
      const srgb = hexToSrgb(hex)
      if (srgb === null) throw new Error(`Could not parse ${hex}`)
      expect(srgbToHex(srgb)).toBe(hex)
    }
  })
})

describe('srgbToHsv and hsvToSrgb', () => {
  it('reads the primaries and the grays', () => {
    expect(srgbToHsv([1, 0, 0])).toEqual({ hue: 0, saturation: 1, value: 1 })
    expect(srgbToHsv([0, 1, 0])).toEqual({ hue: 120, saturation: 1, value: 1 })
    expect(srgbToHsv([0, 0, 1])).toEqual({ hue: 240, saturation: 1, value: 1 })
    expect(srgbToHsv([0.5, 0.5, 0.5])).toEqual({ hue: 0, saturation: 0, value: 0.5 })
  })

  it('writes the primaries', () => {
    expect(hsvToSrgb({ hue: 0, saturation: 1, value: 1 })).toEqual([1, 0, 0])
    expect(hsvToSrgb({ hue: 120, saturation: 1, value: 1 })).toEqual([0, 1, 0])
    expect(hsvToSrgb({ hue: 360, saturation: 1, value: 1 })).toEqual([1, 0, 0])
    expect(hsvToSrgb({ hue: 200, saturation: 0, value: 0.25 })).toEqual([0.25, 0.25, 0.25])
  })

  it('round-trips hex to sRGB to HSV and back to the same hex', () => {
    for (const color of eightBitColors()) {
      const hex = srgbToHex(color)
      const srgb = hexToSrgb(hex)
      if (srgb === null) throw new Error(`Could not parse ${hex}`)
      expect(srgbToHex(hsvToSrgb(srgbToHsv(srgb)))).toBe(hex)
    }
  })
})

describe('srgbToLinear and linearToSrgb', () => {
  it('maps the extremes to themselves', () => {
    expect(srgbToLinear([0, 0, 0])).toEqual([0, 0, 0])
    expect(srgbToLinear([1, 1, 1])).toEqual([1, 1, 1])
    expectRgbClose(linearToSrgb([1, 1, 1]), [1, 1, 1], Number.EPSILON)
  })

  it('applies the sRGB transfer curve per channel', () => {
    const [red, green, blue] = srgbToLinear([128 / 255, 128 / 255, 0])
    expect(red).toBeCloseTo(0.2158605, 6)
    expect(green).toBeCloseTo(0.2158605, 6)
    expect(blue).toBe(0)
  })

  it('round-trips linear to sRGB and back within 1/255', () => {
    for (const color of eightBitColors()) {
      expectRgbClose(linearToSrgb(srgbToLinear(color)), color, ONE_STEP)
      expectRgbClose(srgbToLinear(linearToSrgb(color)), color, ONE_STEP)
    }
  })

  it('keeps every 8-bit level on the same hex after a trip through linear', () => {
    for (let level = 0; level <= 255; level += 1) {
      const hex = `#${level.toString(16).padStart(2, '0').repeat(3)}`
      const srgb = hexToSrgb(hex)
      if (srgb === null) throw new Error(`Could not parse ${hex}`)
      expect(srgbToHex(linearToSrgb(srgbToLinear(srgb)))).toBe(hex)
    }
  })
})

describe('withSrgb', () => {
  it('keeps the previous hue and saturation where the new color leaves them undefined', () => {
    const previous = { hue: 210, saturation: 0.6, value: 0.8 }
    expect(withSrgb(previous, [0.5, 0.5, 0.5]).hsv).toEqual({
      hue: 210,
      saturation: 0,
      value: 0.5,
    })
    expect(withSrgb(previous, [0, 0, 0]).hsv).toEqual({ hue: 210, saturation: 0.6, value: 0 })
  })

  it('takes the new color as-is when it has a hue', () => {
    const next = withSrgb({ hue: 210, saturation: 0.6, value: 0.8 }, [1, 0, 0])
    expect(next.srgb).toEqual([1, 0, 0])
    expect(next.hsv).toEqual({ hue: 0, saturation: 1, value: 1 })
  })
})
