import { describe, expect, it } from 'vitest'

import { createFlatQuadsGeometry } from './grid-floor-geometry'
import type { FlatQuad } from './grid-floor-layout'

const VERTICES_PER_QUAD = 4
const LIFT = -0.02
const QUADS: readonly FlatQuad[] = [
  { x: 0, z: 0, roll: 0 },
  { x: 2, z: -4, roll: Math.PI / 2 },
]

function axisValues(axis: 'x' | 'y' | 'z'): number[] {
  const geometry = createFlatQuadsGeometry(1, 0.1, QUADS, LIFT)
  const positions = geometry.getAttribute('position')
  return Array.from({ length: positions.count }, (_, index) => {
    if (axis === 'x') return positions.getX(index)
    if (axis === 'y') return positions.getY(index)
    return positions.getZ(index)
  })
}

describe('createFlatQuadsGeometry', () => {
  it('bakes every quad into one non-instanced geometry', () => {
    const geometry = createFlatQuadsGeometry(1, 0.1, QUADS, LIFT)
    expect(geometry.getAttribute('position').count).toBe(QUADS.length * VERTICES_PER_QUAD)
    expect(geometry.index?.count).toBe(QUADS.length * 6)
  })

  it('lays every quad flat at the lift height', () => {
    for (const y of axisValues('y')) expect(y).toBeCloseTo(LIFT)
  })

  it('places and spins each quad within the floor plane', () => {
    const xs = axisValues('x')
    const zs = axisValues('z')
    // The unrolled quad runs along X; the rolled one runs along Z around (2, -4).
    expect(Math.min(...xs.slice(0, VERTICES_PER_QUAD))).toBeCloseTo(-0.5)
    expect(Math.max(...xs.slice(0, VERTICES_PER_QUAD))).toBeCloseTo(0.5)
    expect(Math.min(...zs.slice(VERTICES_PER_QUAD))).toBeCloseTo(-4.5)
    expect(Math.max(...zs.slice(VERTICES_PER_QUAD))).toBeCloseTo(-3.5)
  })
})
