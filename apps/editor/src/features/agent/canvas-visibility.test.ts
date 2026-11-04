import { afterEach, describe, expect, it } from 'vitest'

import { CANVAS_OVERLAY_ATTRIBUTE } from '@/features/canvas/measure-canvas-insets'
import { CANVAS_ID } from '@/shared/lib/landmarks'

import { EDGE_INDICATOR_ATTRIBUTE, isCanvasPointShown } from './canvas-visibility'
import type { HitTestDocument } from './canvas-visibility'

const POINT = { x: 120, y: 40 }

/** jsdom has no hit testing: stand in the element the browser would hit at the point. */
function withHit(hit: Element | null): HitTestDocument {
  return {
    getElementById: (id) => document.getElementById(id),
    elementFromPoint: () => hit,
  }
}

function mountCanvas(): HTMLElement {
  const canvas = document.createElement('main')
  canvas.id = CANVAS_ID
  document.body.append(canvas)
  return canvas
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('isCanvasPointShown', () => {
  it('is shown when the hit lands on the canvas, between the header islands', () => {
    const canvas = mountCanvas()
    const pane = document.createElement('div')
    canvas.append(pane)
    expect(isCanvasPointShown(POINT, withHit(pane))).toBe(true)
  })

  it('is hidden when a panel covers the point', () => {
    const canvas = mountCanvas()
    const panel = document.createElement('section')
    panel.setAttribute(CANVAS_OVERLAY_ATTRIBUTE, '')
    const row = document.createElement('div')
    panel.append(row)
    canvas.append(panel)
    expect(isCanvasPointShown(POINT, withHit(row))).toBe(false)
  })

  it('is hidden when the point is off the canvas, or only the edge pointer is there', () => {
    const canvas = mountCanvas()
    const elsewhere = document.createElement('aside')
    document.body.append(elsewhere)
    expect(isCanvasPointShown(POINT, withHit(elsewhere))).toBe(false)
    expect(isCanvasPointShown(POINT, withHit(null))).toBe(false)

    const pointer = document.createElement('button')
    pointer.setAttribute(EDGE_INDICATOR_ATTRIBUTE, '')
    canvas.append(pointer)
    expect(isCanvasPointShown(POINT, withHit(pointer))).toBe(false)
  })

  it('cannot tell without a canvas or without hit testing', () => {
    expect(isCanvasPointShown(POINT, withHit(null))).toBeNull()
    mountCanvas()
    const withoutHitTesting: HitTestDocument = {
      getElementById: (id) => document.getElementById(id),
    }
    expect(isCanvasPointShown(POINT, withoutHitTesting)).toBeNull()
  })
})
