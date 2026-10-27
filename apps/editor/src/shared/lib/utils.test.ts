import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('keeps a text color beside the custom font sizes', () => {
    expect(cn('text-muted-foreground', 'text-micro')).toBe('text-muted-foreground text-micro')
    expect(cn('text-muted-foreground', 'md:text-field')).toBe('text-muted-foreground md:text-field')
  })

  it('treats the custom font sizes as font sizes', () => {
    expect(cn('text-xs', 'text-micro')).toBe('text-micro')
    expect(cn('md:text-sm', 'md:text-field')).toBe('md:text-field')
    expect(cn('md:text-field', 'md:text-xs')).toBe('md:text-xs')
  })
})
