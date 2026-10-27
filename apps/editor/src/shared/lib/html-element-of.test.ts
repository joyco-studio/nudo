import { describe, expect, it } from 'vitest'

import { htmlElementOf } from './html-element-of'

describe('htmlElementOf', () => {
  it('returns an HTML element target as is', () => {
    const button = document.createElement('button')
    expect(htmlElementOf(button)).toBe(button)
  })

  it('returns null for no target, the window, or a non-HTML element', () => {
    expect(htmlElementOf(null)).toBeNull()
    expect(htmlElementOf(window)).toBeNull()
    expect(htmlElementOf(document.createElementNS('http://www.w3.org/2000/svg', 'path'))).toBeNull()
  })
})
