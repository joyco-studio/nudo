import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useControllableOpen } from './use-controllable-open'
import type { ControllableOpenOptions } from './use-controllable-open'

interface Rendered {
  isOpen: boolean
  setOpen: (open: boolean) => void
}

describe('useControllableOpen', () => {
  let root: Root
  let rendered: Rendered

  function Harness(options: ControllableOpenOptions) {
    const [isOpen, setOpen] = useControllableOpen(options)
    rendered = { isOpen, setOpen }
    return null
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    root = createRoot(document.createElement('div'))
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
  })

  it('keeps its own state when uncontrolled and reports every change', () => {
    const onOpenChange = vi.fn()
    act(() => {
      root.render(<Harness defaultOpen={false} onOpenChange={onOpenChange} />)
    })
    expect(rendered.isOpen).toBe(false)

    act(() => {
      rendered.setOpen(true)
    })
    expect(rendered.isOpen).toBe(true)
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('follows the open prop when controlled', () => {
    const onOpenChange = vi.fn()
    act(() => {
      root.render(<Harness open={false} onOpenChange={onOpenChange} />)
    })

    act(() => {
      rendered.setOpen(true)
    })
    expect(rendered.isOpen).toBe(false)
    expect(onOpenChange).toHaveBeenCalledWith(true)

    act(() => {
      root.render(<Harness open onOpenChange={onOpenChange} />)
    })
    expect(rendered.isOpen).toBe(true)
  })
})
