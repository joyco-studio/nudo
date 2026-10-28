import { VECTOR_TYPES } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { canReroute } from './reroute'

describe('canReroute', () => {
  it('carries every vector type, and no texture', () => {
    expect(VECTOR_TYPES.every(canReroute)).toBe(true)
    expect(canReroute('texture')).toBe(false)
  })
})
