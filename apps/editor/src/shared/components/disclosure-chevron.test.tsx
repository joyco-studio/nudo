import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DisclosureChevron } from './disclosure-chevron'

describe('DisclosureChevron', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  function render(isOpen: boolean): SVGElement {
    act(() => {
      root.render(<DisclosureChevron isOpen={isOpen} />)
    })
    const icon = container.querySelector('svg')
    if (icon === null) throw new Error('Chevron not rendered')
    return icon
  }

  it('is hidden from assistive technology', () => {
    expect(render(true).getAttribute('aria-hidden')).toBe('true')
  })

  it('points down when open and quarter-turned when closed', () => {
    expect(render(true).style.transform).toBe('rotate(0deg)')
    expect(render(false).style.transform).toBe('rotate(-90deg)')
  })

  it('keeps the same element when it toggles, so the rotation can transition', () => {
    const closed = render(false)
    const open = render(true)
    expect(open).toBe(closed)
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })
})
