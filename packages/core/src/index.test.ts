import { describe, expect, it } from 'vitest'
import { CORE_VERSION } from './index'

describe('core', () => {
  it('exposes the core version as a string', () => {
    expect(typeof CORE_VERSION).toBe('string')
  })
})
