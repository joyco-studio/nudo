import { describe, expect, it } from 'vitest'
import { linearToSrgbHex, srgbHexToLinear } from './color-space'

describe('srgbHexToLinear', () => {
  it('maps black and white to the linear extremes', () => {
    expect(srgbHexToLinear('#000000')).toEqual([0, 0, 0])
    expect(srgbHexToLinear('#ffffff')).toEqual([1, 1, 1])
  })

  it('applies the sRGB transfer curve per channel', () => {
    const linear = srgbHexToLinear('#808000')
    expect(linear?.[0]).toBeCloseTo(0.2158605, 6)
    expect(linear?.[1]).toBeCloseTo(0.2158605, 6)
    expect(linear?.[2]).toBe(0)
  })

  it('accepts uppercase hex', () => {
    expect(srgbHexToLinear('#FF0000')).toEqual([1, 0, 0])
  })

  it('returns null for text that is not a 6-digit hex color', () => {
    expect(srgbHexToLinear('red')).toBeNull()
    expect(srgbHexToLinear('#fff')).toBeNull()
  })
})

describe('linearToSrgbHex', () => {
  it('encodes linear values back to sRGB hex', () => {
    expect(linearToSrgbHex([0, 0, 0])).toBe('#000000')
    expect(linearToSrgbHex([1, 1, 1])).toBe('#ffffff')
    expect(linearToSrgbHex([0.2158605, 0.2158605, 0])).toBe('#808000')
  })

  it('clamps out-of-range (HDR) values for display', () => {
    expect(linearToSrgbHex([4, -1, 0.5])).toBe('#ff00bc')
  })

  it('round-trips every 8-bit channel value', () => {
    for (let channel = 0; channel <= 255; channel += 1) {
      const hex = `#${channel.toString(16).padStart(2, '0').repeat(3)}`
      const linear = srgbHexToLinear(hex)
      if (linear === null) throw new Error(`Could not parse ${hex}`)
      expect(linearToSrgbHex(linear)).toBe(hex)
    }
  })
})
