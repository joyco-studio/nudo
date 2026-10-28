import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useForcedTooltipOpen } from './use-forced-tooltip-open'
import type { ForcedTooltipOpen } from './use-forced-tooltip-open'

describe('useForcedTooltipOpen', () => {
  let root: Root
  let rendered: ReturnType<typeof useForcedTooltipOpen>

  function Harness({ forced }: { forced: ForcedTooltipOpen }) {
    rendered = useForcedTooltipOpen(forced)
    return null
  }

  const render = (forced: ForcedTooltipOpen): void => {
    act(() => {
      root.render(<Harness forced={forced} />)
    })
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

  it('follows hover and focus while nothing forces it', () => {
    render(null)
    expect(rendered.open).toBe(false)

    act(() => {
      rendered.onOpenChange(true)
    })
    expect(rendered.open).toBe(true)

    act(() => {
      rendered.onOpenChange(false)
    })
    expect(rendered.open).toBe(false)
  })

  it('is always a boolean, so a tooltip is never switched between uncontrolled and controlled', () => {
    for (const forced of [null, true, false, null] as const) {
      render(forced)
      expect(typeof rendered.open).toBe('boolean')
    }
  })

  it('stays shut while forced shut and does not reopen from a hover it ignored', () => {
    render(false)
    act(() => {
      rendered.onOpenChange(true)
    })
    expect(rendered.open).toBe(false)

    render(null)
    expect(rendered.open).toBe(false)
  })

  it('forgets a hover that was open before it was forced shut', () => {
    render(null)
    act(() => {
      rendered.onOpenChange(true)
    })
    render(false)
    expect(rendered.open).toBe(false)

    render(null)
    expect(rendered.open).toBe(false)
  })

  it('stays pinned open while forced open and closes when released, whatever hover did', () => {
    render(null)
    act(() => {
      rendered.onOpenChange(true)
    })
    render(true)
    act(() => {
      rendered.onOpenChange(false)
    })
    expect(rendered.open).toBe(true)

    render(null)
    expect(rendered.open).toBe(false)
  })
})
