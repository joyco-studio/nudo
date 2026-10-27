import { describe, expect, it } from 'vitest'
import { formatNumber, literalOf } from './literals'

const colorCode = (r: number, g: number, b: number): string =>
  literalOf({ type: 'vec3', value: [r, g, b] }, true).code

describe('color literals (linear to sRGB hex)', () => {
  it.each([
    { name: 'black', rgb: [0, 0, 0], expected: 'color(0x000000)' },
    { name: 'white', rgb: [1, 1, 1], expected: 'color(0xffffff)' },
    // 0.8 linear encodes to 0.9063 sRGB, which is byte 231 (0xe7).
    { name: 'light grey', rgb: [0.8, 0.8, 0.8], expected: 'color(0xe7e7e7)' },
    // Byte 128 is sRGB 0.50196, which is 0.21586 linear; a hair less rounds down to 127.
    { name: 'byte 128', rgb: [0.2158605, 0.2158605, 0.2158605], expected: 'color(0x808080)' },
    { name: 'byte 127', rgb: [0.2122, 0.2122, 0.2122], expected: 'color(0x7f7f7f)' },
    // Below the 0.0031308 knee the curve is linear (x * 12.92): 0.001 gives byte 3.
    { name: 'the linear segment', rgb: [0.001, 0.0031308, 0.0031309], expected: 'color(0x030a0a)' },
    { name: 'channel order', rgb: [1, 0, 0.0031308], expected: 'color(0xff000a)' },
  ])('writes $name ($rgb) as $expected', ({ rgb, expected }) => {
    const [red = 0, green = 0, blue = 0] = rgb
    expect(colorCode(red, green, blue)).toBe(expected)
  })

  it('keeps an HDR or negative color as an exact vec3', () => {
    expect(colorCode(4, 0.5, 0)).toBe('vec3(4, 0.5, 0)')
    expect(colorCode(-0.1, 0.5, 0.5)).toBe('vec3(-0.1, 0.5, 0.5)')
  })

  it('writes a non-color vec3 as a vec3', () => {
    expect(literalOf({ type: 'vec3', value: [0.5, 0.25, 0.125] }, false).code).toBe(
      'vec3(0.5, 0.25, 0.125)',
    )
  })
})

describe('formatNumber', () => {
  it('writes -0 as 0 and keeps other numbers as they print', () => {
    expect(formatNumber(-0)).toBe('0')
    expect(formatNumber(0.1)).toBe('0.1')
    expect(formatNumber(1e-7)).toBe('1e-7')
  })

  it('refuses values a shader cannot hold', () => {
    expect(() => formatNumber(Number.NaN)).toThrow('NaN')
    expect(() => formatNumber(Number.NEGATIVE_INFINITY)).toThrow('-Infinity')
  })
})
