import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  Vector3,
} from 'three'

import type { PrimitiveShape } from './preview-shape'

/** Shapes three.js can build in code; the rest load from a file. */
export type GeneratedShape = Exclude<PrimitiveShape, 'suzanne'>

export const GENERATED_SHAPES: readonly GeneratedShape[] = [
  'sphere',
  'cube',
  'plane',
  'torus',
  'knot',
]

/** Segment counts are high enough that vertex-displacement nodes have something to move. */
const SPHERE_ARGS = [1, 96, 48] as const
const CUBE_ARGS = [1.5, 1.5, 1.5, 24, 24, 24] as const
const PLANE_ARGS = [2.4, 2.4, 96, 96] as const
const TORUS_ARGS = [0.85, 0.35, 64, 128] as const
/** A (2,3) trefoil: curvature and self-occlusion change everywhere, so shading reads at every angle. */
const KNOT_ARGS = [0.6, 0.2, 256, 48, 2, 3] as const

export function createPrimitiveGeometry(shape: GeneratedShape): BufferGeometry {
  switch (shape) {
    case 'sphere':
      return new SphereGeometry(...SPHERE_ARGS)
    case 'cube':
      return new BoxGeometry(...CUBE_ARGS)
    case 'plane':
      return new PlaneGeometry(...PLANE_ARGS)
    case 'torus':
      return new TorusGeometry(...TORUS_ARGS)
    case 'knot':
      return new TorusKnotGeometry(...KNOT_ARGS)
  }
}

/**
 * Whether the outline pass draws a hull around the shape. A plane has no back to wrap: its hull
 * would sit in front of it and cover it whole from behind, so the plane gets no outline.
 */
export function shapeHasHull(shape: GeneratedShape): boolean {
  return shape !== 'plane'
}

/** Positions closer than this (in object units) are one corner, split only for its normals. */
const WELD_STEP = 1e-4
/** Two normals this aligned (cosine of the angle between them) are the same direction. */
const SAME_DIRECTION = 0.9999
const NORMAL_COMPONENTS = 3

function cornerKey(position: Vector3): string {
  const snap = (value: number) => Math.round(value / WELD_STEP)
  return `${String(snap(position.x))},${String(snap(position.y))},${String(snap(position.z))}`
}

/**
 * Each vertex's normal averaged with the other directions its corner faces. A hard edge splits a
 * corner into one vertex per face; pushed out along those face normals, the hull would tear open
 * at the edge (a notch in the outline). Each distinct direction counts once, so a seam that only
 * repeats a vertex (the sphere's UV seam) does not tilt the average.
 */
function smoothedNormals(surface: BufferGeometry): BufferAttribute {
  const positions = surface.getAttribute('position')
  const normals = surface.getAttribute('normal')
  const directionsByCorner = new Map<string, Vector3[]>()
  const keys: string[] = []
  const position = new Vector3()
  for (let index = 0; index < positions.count; index += 1) {
    const key = cornerKey(position.fromBufferAttribute(positions, index))
    keys.push(key)
    const normal = new Vector3().fromBufferAttribute(normals, index)
    const directions = directionsByCorner.get(key) ?? []
    if (!directions.some((known) => known.dot(normal) > SAME_DIRECTION)) directions.push(normal)
    directionsByCorner.set(key, directions)
  }
  const averages = new Map<string, Vector3>()
  for (const [key, directions] of directionsByCorner) {
    const sum = directions.reduce((total, direction) => total.add(direction), new Vector3())
    averages.set(key, sum.normalize())
  }
  const smoothed = new Float32Array(positions.count * NORMAL_COMPONENTS)
  keys.forEach((key, index) => {
    averages.get(key)?.toArray(smoothed, index * NORMAL_COMPONENTS)
  })
  return new BufferAttribute(smoothed, NORMAL_COMPONENTS)
}

/**
 * The geometry the outline pass draws: the surface's own index and attributes (shared, not
 * copied) with smoothed normals, so the hull stays closed over hard edges like the cube's. It
 * shares the surface's buffers, so it must be disposed with the surface, never before it.
 */
export function createHullGeometry(surface: BufferGeometry): BufferGeometry {
  const hull = new BufferGeometry()
  hull.setIndex(surface.getIndex())
  for (const [name, attribute] of Object.entries(surface.attributes)) {
    hull.setAttribute(name, attribute)
  }
  hull.setAttribute('normal', smoothedNormals(surface))
  return hull
}
