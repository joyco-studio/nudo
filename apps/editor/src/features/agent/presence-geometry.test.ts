import { asNodeId } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import {
  NODE_HEADER_HEIGHT,
  edgeIndicatorFor,
  edgeIndicatorWithin,
  lookupFromNodes,
  screenPointFor,
  wirePath,
} from './presence-geometry'
import type { PresenceLookup } from './presence-geometry'

const NODE_ID = asNodeId('noise')
const ZOOM = 2
const PAN = { x: 10, y: 20 }

const lookup: PresenceLookup = lookupFromNodes(
  (nodeId) =>
    nodeId === NODE_ID
      ? {
          position: { x: 100, y: 50 },
          width: 200,
          height: 120,
          handles: [{ id: 'out', x: 196, y: 40, width: 8, height: 8 }],
        }
      : null,
  { ...PAN, zoom: ZOOM },
)

describe('screenPointFor', () => {
  it('places a flow point through the viewport transform', () => {
    expect(screenPointFor({ kind: 'point', position: { x: 5, y: 5 } }, lookup)).toEqual({
      x: 20,
      y: 30,
    })
  })

  it('points at the middle of a node header', () => {
    expect(screenPointFor({ kind: 'node', nodeId: NODE_ID }, lookup)).toEqual({
      x: (100 + 100) * ZOOM + PAN.x,
      y: (50 + NODE_HEADER_HEIGHT / 2) * ZOOM + PAN.y,
    })
  })

  it('points at the center of a port handle', () => {
    const target = { kind: 'port', ref: { nodeId: NODE_ID, portId: 'out' } } as const
    expect(screenPointFor(target, lookup)).toEqual({
      x: (100 + 200) * ZOOM + PAN.x,
      y: (50 + 44) * ZOOM + PAN.y,
    })
  })

  it('is null for a node or port that is not on the canvas', () => {
    expect(screenPointFor({ kind: 'node', nodeId: asNodeId('gone') }, lookup)).toBeNull()
    const missingPort = { kind: 'port', ref: { nodeId: NODE_ID, portId: 'nope' } } as const
    expect(screenPointFor(missingPort, lookup)).toBeNull()
  })
})

describe('edgeIndicatorFor', () => {
  const viewport = { width: 800, height: 600 }
  const inset = 24

  it('edgeIndicatorFor returns null for a visible point and clamps an offscreen point to the inset border', () => {
    expect(edgeIndicatorFor({ x: 400, y: 300 }, viewport, inset)).toBeNull()

    const right = edgeIndicatorFor({ x: 1400, y: 300 }, viewport, inset)
    expect(right).toEqual({ x: 800 - inset, y: 300, angle: 0 })

    const aboveLeft = edgeIndicatorFor({ x: -200, y: -900 }, viewport, inset)
    expect(aboveLeft?.x).toBe(inset)
    expect(aboveLeft?.y).toBe(inset)
    expect(aboveLeft?.angle).toBeLessThan(-90)
  })

  it('points straight down at a target below the view', () => {
    expect(edgeIndicatorFor({ x: 400, y: 2000 }, viewport, inset)).toEqual({
      x: 400,
      y: 600 - inset,
      angle: 90,
    })
  })
})

describe('edgeIndicatorWithin', () => {
  it('treats a point behind a panel as off-screen and pins the pointer beside the panel', () => {
    const panels = { top: 0, right: 300, bottom: 0, left: 0 }
    const indicator = edgeIndicatorWithin(
      { x: 700, y: 300 },
      { width: 800, height: 600 },
      panels,
      24,
    )
    expect(indicator).toEqual({ x: 500 - 24, y: 300, angle: 0 })
  })
})

describe('wirePath', () => {
  it('curves from the port to the loose end', () => {
    expect(wirePath({ x: 0, y: 0 }, { x: 200, y: 50 })).toBe('M 0 0 C 100 0, 100 50, 200 50')
  })
})
