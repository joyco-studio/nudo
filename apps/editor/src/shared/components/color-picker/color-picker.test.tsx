import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Rgb } from './color-math'
import { ColorPicker } from './color-picker'

const VALUE: Rgb = [0.5, 0.25, 0.1]

/** jsdom has no ResizeObserver; Radix measures the slider thumb with one. */
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('ColorPicker', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    container.remove()
    vi.unstubAllGlobals()
  })

  function renderPicker(callbacks: { onPreview: () => void; onCancel: () => void }): void {
    act(() => {
      root.render(
        <ColorPicker
          label="Base Color"
          value={VALUE}
          onPreview={callbacks.onPreview}
          onCommit={vi.fn()}
          onCancel={callbacks.onCancel}
        />,
      )
    })
  }

  it('cancels its live preview when it unmounts while open', () => {
    const onCancel = vi.fn()
    renderPicker({ onPreview: vi.fn(), onCancel })
    const swatch = container.querySelector('button[aria-label="Base Color"]')
    if (!(swatch instanceof HTMLButtonElement)) throw new Error('Swatch not rendered')

    act(() => {
      swatch.click()
    })
    act(() => {
      root.unmount()
    })

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does nothing on unmount when it was never opened', () => {
    const onCancel = vi.fn()
    renderPicker({ onPreview: vi.fn(), onCancel })
    act(() => {
      root.unmount()
    })
    expect(onCancel).not.toHaveBeenCalled()
  })
})
