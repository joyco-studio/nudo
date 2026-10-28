import { describe, expect, it } from 'vitest'

import { linearToSrgb, srgbToHex } from '@/shared/components/color-picker/color-math'

import { hexColor } from './hex-color'

describe('hexColor', () => {
  it.each(['#1B1F6B', '#FF4FA3', '#7CF7FF', '#044D3E', '#F9F2BC'])(
    'stores %s in linear light that reads back as the same hex',
    (hex) => {
      const value = hexColor(hex)
      if (value.type !== 'vec3') throw new Error('Expected a vec3')
      expect(srgbToHex(linearToSrgb(value.value))).toBe(hex)
    },
  )

  it('rejects text that is not #RRGGBB', () => {
    expect(() => hexColor('blue')).toThrow()
  })
})
