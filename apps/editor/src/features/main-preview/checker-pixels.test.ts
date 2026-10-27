import { describe, expect, it } from 'vitest'

import { checkerPixels } from './checker-pixels'

const LIGHT = [200, 200, 200] as const
const DARK = [90, 90, 90] as const

describe('checkerPixels', () => {
  it('alternates two opaque colors cell by cell', () => {
    const pixels = checkerPixels(2, LIGHT, DARK)
    expect(Array.from(pixels)).toEqual([...LIGHT, 255, ...DARK, 255, ...DARK, 255, ...LIGHT, 255])
  })
})
