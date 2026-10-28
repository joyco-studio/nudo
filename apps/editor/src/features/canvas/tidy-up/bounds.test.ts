import { describe, expect, it } from 'vitest'

import { boundsOf } from './bounds'

describe('boundsOf', () => {
  it('encloses every box', () => {
    expect(
      boundsOf([
        { position: { x: 10, y: 20 }, width: 100, height: 50 },
        { position: { x: -30, y: 60 }, width: 20, height: 40 },
      ]),
    ).toEqual({ x: -30, y: 20, width: 140, height: 80 })
  })
})
