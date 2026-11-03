import { describe, expect, it } from 'vitest'

import { formatElapsed } from './use-task-timer'

describe('formatElapsed', () => {
  it('shows minutes and zero-padded seconds', () => {
    expect(formatElapsed(14_000)).toBe('0:14')
    expect(formatElapsed(723_000)).toBe('12:03')
  })

  it('rounds down to the whole second and never goes below zero', () => {
    expect(formatElapsed(59_999)).toBe('0:59')
    expect(formatElapsed(60_000)).toBe('1:00')
    expect(formatElapsed(-500)).toBe('0:00')
  })
})
