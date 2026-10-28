import { describe, expect, it } from 'vitest'

import {
  CROSS_COUNT,
  GRID_DIVISIONS,
  GRID_SIZE,
  crossQuads,
  gridLineQuads,
} from './grid-floor-layout'

const QUARTER_TURN = Math.PI / 2

describe('gridLineQuads', () => {
  const lines = gridLineQuads()

  it('lays one line along each axis per division edge', () => {
    expect(lines).toHaveLength((GRID_DIVISIONS + 1) * 2)
    expect(lines.filter((line) => line.roll === 0)).toHaveLength(GRID_DIVISIONS + 1)
    expect(lines.filter((line) => line.roll === QUARTER_TURN)).toHaveLength(GRID_DIVISIONS + 1)
  })

  it('spans the whole grid, edge to edge', () => {
    const offsets = lines.filter((line) => line.roll === 0).map((line) => line.z)
    expect(Math.min(...offsets)).toBe(-GRID_SIZE / 2)
    expect(Math.max(...offsets)).toBe(GRID_SIZE / 2)
  })
})

describe('crossQuads', () => {
  const crosses = crossQuads()

  it('draws a two-bar "+" at every other intersection except the center', () => {
    expect(crosses).toHaveLength((CROSS_COUNT * CROSS_COUNT - 1) * 2)
    expect(crosses.every((quad) => quad.x % 2 === 0 && quad.z % 2 === 0)).toBe(true)
  })

  it('keeps the center clear, under the mesh', () => {
    expect(crosses.some((quad) => quad.x === 0 && quad.z === 0)).toBe(false)
  })

  it('is centered on the origin', () => {
    const xs = crosses.map((quad) => quad.x)
    expect(Math.min(...xs)).toBe(-Math.max(...xs))
  })
})
