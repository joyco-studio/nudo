import { describe, expect, it } from 'vitest'

import { fitViewOptionsFor } from './fit-view-options'
import { NO_INSETS } from './viewport-insets'

describe('fitViewOptionsFor', () => {
  it('pads the fit by the measured insets plus a margin, never past 100%', () => {
    expect(fitViewOptionsFor(1440, { top: 48, right: 336, bottom: 48, left: 256 })).toEqual({
      maxZoom: 1,
      padding: { top: '72px', right: '360px', bottom: '72px', left: '280px' },
    })
  })

  it('keeps fields legible on a narrow canvas', () => {
    expect(fitViewOptionsFor(390, NO_INSETS)).toEqual({
      maxZoom: 1,
      minZoom: 0.75,
      padding: { top: '24px', right: '24px', bottom: '24px', left: '24px' },
    })
  })
})
