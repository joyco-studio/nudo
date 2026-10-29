import { describe, expect, it } from 'vitest'

import { scrollOverflow } from './use-scroll-overflow'

describe('scrollOverflow', () => {
  it('has nothing to scroll when the content fits', () => {
    expect(scrollOverflow({ scrollTop: 0, scrollHeight: 200, clientHeight: 200 })).toEqual({
      isScrollable: false,
      hasMoreBelow: false,
    })
  })

  it('has more below until the end is reached', () => {
    expect(scrollOverflow({ scrollTop: 0, scrollHeight: 600, clientHeight: 200 })).toEqual({
      isScrollable: true,
      hasMoreBelow: true,
    })
    expect(scrollOverflow({ scrollTop: 400, scrollHeight: 600, clientHeight: 200 })).toEqual({
      isScrollable: true,
      hasMoreBelow: false,
    })
  })

  it('ignores the sub-pixel rounding a fractional zoom leaves at the end', () => {
    expect(scrollOverflow({ scrollTop: 399.5, scrollHeight: 600, clientHeight: 200 })).toEqual({
      isScrollable: true,
      hasMoreBelow: false,
    })
  })
})
