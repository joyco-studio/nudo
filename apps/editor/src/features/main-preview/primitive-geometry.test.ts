import { BoxGeometry, SphereGeometry, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'

import {
  GENERATED_SHAPES,
  createHullGeometry,
  createPrimitiveGeometry,
  shapeHasHull,
} from './primitive-geometry'

function normalAt(geometry: BufferGeometry, index: number): Vector3 {
  return new Vector3().fromBufferAttribute(geometry.getAttribute('normal'), index)
}

function positionAt(geometry: BufferGeometry, index: number): Vector3 {
  return new Vector3().fromBufferAttribute(geometry.getAttribute('position'), index)
}

/** Every vertex index sitting at `corner`. */
function verticesAt(geometry: BufferGeometry, corner: Vector3): number[] {
  const count = geometry.getAttribute('position').count
  return Array.from({ length: count }, (_, index) => index).filter(
    (index) => positionAt(geometry, index).distanceTo(corner) < 1e-6,
  )
}

describe('createPrimitiveGeometry', () => {
  it('builds a geometry with normals and UVs for every generated shape', () => {
    for (const shape of GENERATED_SHAPES) {
      const geometry = createPrimitiveGeometry(shape)

      expect(geometry.getAttribute('normal'), shape).toBeDefined()
      expect(geometry.getAttribute('uv'), shape).toBeDefined()
    }
  })
})

describe('shapeHasHull', () => {
  it('gives every closed shape a hull, but not the plane, which has no back to wrap', () => {
    expect(GENERATED_SHAPES.filter(shapeHasHull)).toEqual(['sphere', 'cube', 'torus', 'knot'])
  })
})

describe('createHullGeometry', () => {
  it('shares the surface buffers, so the mesh is not copied, and owns only its normals', () => {
    const surface = new BoxGeometry(1, 1, 1, 2, 2, 2)

    const hull = createHullGeometry(surface)

    expect(hull.getIndex()).toBe(surface.getIndex())
    expect(hull.getAttribute('position')).toBe(surface.getAttribute('position'))
    expect(hull.getAttribute('uv')).toBe(surface.getAttribute('uv'))
    expect(hull.getAttribute('normal')).not.toBe(surface.getAttribute('normal'))
  })

  it('gives the split vertices of a hard corner one shared normal, so the hull never notches', () => {
    const surface = new BoxGeometry(1, 1, 1)
    const corner = new Vector3(0.5, 0.5, 0.5)

    const hull = createHullGeometry(surface)
    const splitVertices = verticesAt(surface, corner)

    expect(splitVertices).toHaveLength(3)
    const diagonal = new Vector3(1, 1, 1).normalize()
    for (const index of splitVertices) {
      expect(normalAt(hull, index).distanceTo(diagonal)).toBeLessThan(1e-6)
    }
  })

  it('leaves an already smooth surface as it was', () => {
    const surface = new SphereGeometry(1, 16, 8)

    const hull = createHullGeometry(surface)

    const count = surface.getAttribute('normal').count
    for (let index = 0; index < count; index += 1) {
      expect(normalAt(hull, index).distanceTo(normalAt(surface, index))).toBeLessThan(1e-5)
    }
  })
})
