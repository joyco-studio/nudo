import { describe, expect, it } from 'vitest'

import {
  NO_INSETS,
  fitPadding,
  insetsFor,
  visibleCenter,
  visibleCenterOffset,
} from './viewport-insets'
import type { ScreenRect } from './viewport-insets'

const rect = (left: number, top: number, right: number, bottom: number): ScreenRect => ({
  left,
  top,
  right,
  bottom,
})

/** A 1440 × 900 window with the canvas filling it, as in the docked layout. */
const CANVAS = rect(0, 0, 1440, 900)
const HEADER = rect(16, 16, 1424, 48)
const PROPERTIES = rect(16, 64, 256, 700)
const INSPECTOR_COLUMN = rect(1104, 64, 1424, 620)
const CODE_COLLAPSED = rect(64, 852, 1088, 884)

describe('insetsFor', () => {
  it('clears each panel on the side it is docked to', () => {
    expect(insetsFor(CANVAS, [HEADER, PROPERTIES, INSPECTOR_COLUMN, CODE_COLLAPSED])).toEqual({
      top: 48,
      right: 336,
      bottom: 48,
      left: 256,
    })
  })

  it('counts a short panel toward the edge a taller neighbor already clears', () => {
    // A collapsed-looking Inspector above a tall Preview in the right-hand column: both are right.
    const shortInspector = rect(944, 64, 1264, 160)
    const tallPreview = rect(944, 168, 1264, 718)
    const canvas = rect(0, 0, 1280, 720)
    expect(insetsFor(canvas, [HEADER, shortInspector, tallPreview])).toMatchObject({
      top: 48,
      right: 336,
    })
  })

  it('keeps the widest inset when two panels sit on the same side', () => {
    const openCode = rect(64, 652, 1088, 884)
    expect(insetsFor(CANVAS, [CODE_COLLAPSED, openCode]).bottom).toBe(248)
  })

  it('ignores panels outside the canvas or with no size (hidden or unmounted)', () => {
    const splitPreview = rect(1500, 64, 1900, 880)
    const hidden = rect(0, 0, 0, 0)
    expect(insetsFor(CANVAS, [splitPreview, hidden])).toEqual(NO_INSETS)
  })

  it('measures relative to the canvas, wherever it sits on the page', () => {
    const splitCanvas = rect(0, 0, 900, 900)
    const inspectorAcrossTheEdge = rect(800, 64, 1200, 620)
    expect(insetsFor(splitCanvas, [inspectorAcrossTheEdge]).right).toBe(100)
  })

  it('drops the insets of an axis that would leave too little of the canvas to see', () => {
    const phone = rect(0, 0, 390, 844)
    const stackedColumn = rect(16, 64, 374, 652)
    const header = rect(16, 16, 374, 48)
    expect(insetsFor(phone, [header, stackedColumn])).toEqual(NO_INSETS)
  })
})

describe('fitPadding', () => {
  it('adds the margin around every inset, in pixels', () => {
    expect(fitPadding({ top: 48, right: 336, bottom: 0, left: 256 }, 24)).toEqual({
      top: '72px',
      right: '360px',
      bottom: '24px',
      left: '280px',
    })
  })
})

describe('visibleCenter', () => {
  const insets = { top: 48, right: 336, bottom: 48, left: 256 }

  it('is the middle of the canvas once the panels are taken off', () => {
    expect(visibleCenter(CANVAS, insets)).toEqual({ x: 680, y: 450 })
  })

  it('offsets from the canvas middle by half the difference of opposite insets', () => {
    expect(visibleCenterOffset(insets)).toEqual({ x: -40, y: 0 })
    expect(visibleCenterOffset(NO_INSETS)).toEqual({ x: 0, y: 0 })
  })
})
