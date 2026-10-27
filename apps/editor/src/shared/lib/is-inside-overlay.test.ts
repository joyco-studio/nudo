import { describe, expect, it } from 'vitest'

import { isInsideOverlay } from './is-inside-overlay'

function elementIn(html: string): Element {
  const host = document.createElement('div')
  host.innerHTML = html
  const element = host.querySelector('[data-target]')
  if (element === null) throw new Error('The markup has no [data-target]')
  return element
}

describe('isInsideOverlay', () => {
  it('is true inside a dialog', () => {
    expect(
      isInsideOverlay(elementIn('<div role="dialog"><button data-target></button></div>')),
    ).toBe(true)
  })

  it('is true inside the toasts, which own the keyboard while focused', () => {
    expect(
      isInsideOverlay(
        elementIn('<ol data-sonner-toaster><li><button data-target></button></li></ol>'),
      ),
    ).toBe(true)
  })

  it('is false elsewhere, and for a target that is not an element', () => {
    expect(isInsideOverlay(elementIn('<main><button data-target></button></main>'))).toBe(false)
    expect(isInsideOverlay(null)).toBe(false)
  })
})
